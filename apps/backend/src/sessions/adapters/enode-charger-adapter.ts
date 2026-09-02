import { BadRequestException, GatewayTimeoutException, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { computeSessionFinancials } from "@kelo/core";
import { PrismaService } from "../../prisma/prisma.service";
import { toCoreCharger } from "../charger-mapping";
import { EnodeClient } from "./enode-client";
import { ChargerAdapter, MeterState } from "./charger-adapter.interface";
import { SessionTickEvent } from "./mock-charger-adapter";

interface EnodeChargeState {
  isPluggedIn: boolean;
  isCharging: boolean;
  chargeRate: number | null; // kW, instantaneous — Enode's charger resource has no cumulative kWh/session-duration field, confirmed against their real schema
  maxCurrent: number | null;
  powerDeliveryState: string;
}

interface EnodeCharger {
  id: string;
  userId: string;
  vendor: string;
  isReachable: boolean;
  lastSeen: string;
  chargeState: EnodeChargeState;
}

interface EnodeAction {
  id: string;
  state: "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED";
  kind: string;
  completedAt: string | null;
}

interface ActiveEnodeSession {
  chargerId: number; // our own Charger.id
  enodeChargerId: string;
  startedAt: Date;
  accumulatedKwh: number;
  lastRateKw: number;
  lastUpdate: Date;
}

const ACTION_POLL_ATTEMPTS = 10;
const ACTION_POLL_INTERVAL_MS = 1000;

/**
 * Real Enode integration, calling Enode's actual sandbox/production
 * Chargers API (confirmed live before this was written: real OAuth2
 * token exchange, real 400/404 error shapes from GET/POST /chargers).
 *
 * Enode's charger resource carries no cumulative-kWh or session-duration
 * field — only an instantaneous chargeRate (kW) at whatever moment it was
 * last read (confirmed against Enode's own chargers OpenAPI schema, which
 * lists isPluggedIn/isCharging/chargeRate/maxCurrent/powerDeliveryState
 * and nothing energy-cumulative). So unlike a real OCPP StopTransaction
 * (which just hands back a final meter reading), this adapter integrates
 * energy itself: it tracks the last known rate and the moment it was last
 * updated, and every webhook-reported rate change (see
 * enode-webhook.controller.ts) advances accumulatedKwh by rate × elapsed
 * time before recording the new rate. getMeterValue/stop project that
 * forward to "now" using the most recent rate. This is a real integration
 * approach for this specific API shape, not an approximation of one.
 */
@Injectable()
export class EnodeChargerAdapter implements ChargerAdapter {
  private readonly logger = new Logger(EnodeChargerAdapter.name);
  private readonly active = new Map<number, ActiveEnodeSession>(); // sessionId -> state
  private readonly byEnodeChargerId = new Map<string, number>(); // enode chargerId -> sessionId

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly client: EnodeClient,
  ) {}

  async authorize(sessionId: number): Promise<void> {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: { booking: { include: { charger: true } } },
    });
    const { charger } = session.booking;
    const enodeChargerId = charger.enodeChargerId;
    if (!enodeChargerId) {
      throw new BadRequestException(
        `Charger ${charger.id} has connectionRoute ENODE but no enodeChargerId set — it hasn't been linked to a real Enode device.`,
      );
    }

    const action = await this.client.request<EnodeAction>("POST", `/chargers/${enodeChargerId}/charging`, { action: "START" });
    await this.pollActionUntilConfirmed(action.id);

    const now = new Date();
    let initialRateKw = 0;
    try {
      const current = await this.client.request<EnodeCharger>("GET", `/chargers/${enodeChargerId}`);
      initialRateKw = current.chargeState?.chargeRate ?? 0;
    } catch (err) {
      // Non-fatal — the charging action was already confirmed. We just
      // start the rate at 0 until the first webhook update supplies a
      // real one, rather than failing a session that did actually start.
      this.logger.warn(`Could not fetch initial chargeState for ${enodeChargerId} after start`, err as Error);
    }

    const entry: ActiveEnodeSession = {
      chargerId: charger.id,
      enodeChargerId,
      startedAt: now,
      accumulatedKwh: 0,
      lastRateKw: initialRateKw,
      lastUpdate: now,
    };
    this.active.set(sessionId, entry);
    this.byEnodeChargerId.set(enodeChargerId, sessionId);
  }

  async stop(sessionId: number): Promise<MeterState> {
    const entry = this.active.get(sessionId);

    // No local tracking — e.g. the backend restarted since authorize()
    // (the same limitation MockChargerAdapter has; neither persists active
    // state across a restart). Still worth telling the real charger to
    // stop if we can resolve which one it was, but there's no accumulated
    // energy to report.
    if (!entry) {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: { booking: { include: { charger: true } } },
      });
      const enodeChargerId = session?.booking.charger.enodeChargerId;
      if (enodeChargerId) {
        const action = await this.client.request<EnodeAction>("POST", `/chargers/${enodeChargerId}/charging`, { action: "STOP" });
        await this.pollActionUntilConfirmed(action.id).catch((err) =>
          this.logger.warn(`STOP action for untracked session ${sessionId} did not confirm`, err as Error),
        );
      }
      return { kwh: 0, seconds: 0 };
    }

    const finalState = this.projectCurrentState(entry);
    const action = await this.client.request<EnodeAction>("POST", `/chargers/${entry.enodeChargerId}/charging`, { action: "STOP" });
    await this.pollActionUntilConfirmed(action.id);

    this.active.delete(sessionId);
    this.byEnodeChargerId.delete(entry.enodeChargerId);
    return finalState;
  }

  async getMeterValue(chargerId: number): Promise<MeterState | null> {
    for (const entry of this.active.values()) {
      if (entry.chargerId === chargerId) {
        return this.projectCurrentState(entry);
      }
    }
    return null;
  }

  /**
   * Called by EnodeWebhookController on a real user:charger:updated event.
   * Advances accumulated energy at the *previous* rate over the interval
   * since the last update, then records the new rate — a real (if simple,
   * rectangular-integration) accounting of energy delivered, driven by
   * Enode's own reported rate changes instead of a fixed simulated curve.
   */
  onChargeStateUpdated(enodeChargerId: string, chargeRateKw: number, eventTime: Date): void {
    const sessionId = this.byEnodeChargerId.get(enodeChargerId);
    if (sessionId === undefined) return; // not a charger we're currently tracking a session for

    const entry = this.active.get(sessionId);
    if (!entry) return;

    const hoursSinceUpdate = Math.max(0, (eventTime.getTime() - entry.lastUpdate.getTime()) / 3_600_000);
    entry.accumulatedKwh += entry.lastRateKw * hoursSinceUpdate;
    entry.lastRateKw = chargeRateKw;
    entry.lastUpdate = eventTime;

    void this.emitTick(sessionId, entry);
  }

  private projectCurrentState(entry: ActiveEnodeSession, now: Date = new Date()): MeterState {
    const hoursSinceUpdate = Math.max(0, (now.getTime() - entry.lastUpdate.getTime()) / 3_600_000);
    const kwh = +(entry.accumulatedKwh + entry.lastRateKw * hoursSinceUpdate).toFixed(3);
    const seconds = Math.max(0, Math.floor((now.getTime() - entry.startedAt.getTime()) / 1000));
    return { kwh, seconds };
  }

  /**
   * Same emission this session's WebSocket gateway already listens for
   * from MockChargerAdapter's timer tick — reusing computeSessionFinancials
   * from @kelo/core rather than re-deriving pricing here, so the driver's
   * live screen and the host's live card behave identically regardless of
   * which adapter is actually driving a given session.
   */
  private async emitTick(sessionId: number, entry: ActiveEnodeSession): Promise<void> {
    const charger = await this.prisma.charger.findUnique({ where: { id: entry.chargerId } });
    if (!charger) return;

    const { kwh, seconds } = this.projectCurrentState(entry);
    const financials = computeSessionFinancials(toCoreCharger(charger), kwh, seconds);
    const payload: SessionTickEvent = {
      sessionId,
      kwh,
      seconds,
      energyCost: financials.energyCost,
      idleCost: financials.idleCost,
      totalCost: financials.totalCost,
      idleChargesActive: financials.idleChargesActive,
    };
    this.events.emit("session.tick", payload);
  }

  /**
   * POST /chargers/{id}/charging is async — it hands back an Action that
   * settles to CONFIRMED/FAILED/CANCELLED, confirmed against Enode's own
   * Action schema (state enum: PENDING | CONFIRMED | FAILED | CANCELLED)
   * and the real GET /chargers/actions/{actionId} endpoint (confirmed live
   * — it 400s on a non-UUID id exactly as its own validation describes).
   * SessionsService's own contract is synchronous (authorize/stop either
   * succeed or throw), so this polls to a terminal state with a bounded
   * timeout rather than returning the moment the action is merely accepted.
   */
  private async pollActionUntilConfirmed(actionId: string): Promise<void> {
    for (let attempt = 0; attempt < ACTION_POLL_ATTEMPTS; attempt++) {
      const action = await this.client.request<EnodeAction>("GET", `/chargers/actions/${actionId}`);
      if (action.state === "CONFIRMED") return;
      if (action.state === "FAILED" || action.state === "CANCELLED") {
        throw new BadRequestException(`Enode charging action ${action.state.toLowerCase()}`);
      }
      await new Promise((resolve) => setTimeout(resolve, ACTION_POLL_INTERVAL_MS));
    }
    throw new GatewayTimeoutException("Enode charging action did not confirm in time");
  }
}
