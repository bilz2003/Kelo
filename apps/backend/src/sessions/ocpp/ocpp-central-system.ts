import {
  BadGatewayException,
  ConflictException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { RPCServer, createRPCError } from "ocpp-rpc";
import { computeSessionFinancials } from "@kelo/core";
import { PrismaService } from "../../prisma/prisma.service";
import { toCoreCharger } from "../charger-mapping";
import { MeterState } from "../adapters/charger-adapter.interface";
import { SessionTickEvent } from "../adapters/mock-charger-adapter";

const START_TIMEOUT_MS = 30_000; // bounded wait for the charge point's own real StartTransaction after RemoteStartTransaction
const STOP_TIMEOUT_MS = 30_000; // bounded wait for the charge point's own real StopTransaction after RemoteStopTransaction

// Real charge points send OCPP Heartbeat at the interval this central
// system itself specifies in BootNotification's response (below) — 300s.
// A charge point that's gone silent — genuinely disconnected and never
// reconnecting, or still technically connected at the WebSocket/TCP
// level but not actually sending anything (a hung charge point, not a
// network failure) — was previously invisible: nothing tracked "when did
// we last hear from it" at all. Checked before writing this, per
// OCPP-INTEGRATION.md's own "What's still open" note that the
// reconnection story was implemented as designed but never exercised as
// its own scenario — confirmed live (a real simulator, hard-killed
// mid-session) that a dropped connection's Session/Booking really did
// stay "active" indefinitely with no reconciliation.
//
// STALE_TIMEOUT_MS deliberately allows a few missed heartbeats, not just
// one late one, before treating a charge point as actually gone — the
// same real-world CSMS heuristic this being a multiple of the heartbeat
// interval reflects. Configurable via OCPP_STALE_TIMEOUT_MS so this can
// be tested against a short window without needing to change the
// production default.
const HEARTBEAT_INTERVAL_SECONDS = 300;
const DEFAULT_STALE_TIMEOUT_MS = 3 * HEARTBEAT_INTERVAL_SECONDS * 1000; // 15 minutes
const STALE_SWEEP_INTERVAL_MS = 10_000; // cheap (a Map scan) — bounds detection latency once the real timeout above is actually crossed

type OcppParams = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- OCPP message bodies; shape enforced at runtime by ocpp-rpc's strictMode + official OCA schemas, not worth re-declaring here

/**
 * ocpp-rpc doesn't export its RPCServerClient type (it's the class the
 * 'client' event hands back, extending its own RPCClient internally) — this
 * is just the slice of its real shape this class actually calls.
 */
interface OcppClientConnection {
  readonly identity: string;
  handle(method: string, handler: (ctx: { params: OcppParams }) => Promise<OcppParams>): void;
  handle(handler: (ctx: { method: string; params: OcppParams }) => Promise<OcppParams>): void;
  call(method: string, params?: OcppParams): Promise<OcppParams>;
  on(event: "close", listener: () => void): void;
}

interface PendingStart {
  sessionId: number;
  resolve: () => void;
  reject: (err: Error) => void;
}

interface PendingStop {
  resolve: (meter: MeterState) => void;
  reject: (err: Error) => void;
}

interface ActiveTransaction {
  chargePointId: string;
  startedAt: Date;
  meterStartKwh: number;
  lastMeterKwh: number;
}

/**
 * The real OCPP 1.6-J central system (CSMS) — one long-lived WebSocket
 * server holding a persistent connection per charge point, per
 * BACKEND-PLAN.md §3. Built on ocpp-rpc (see OCPP-INTEGRATION.md for the
 * reasoning): it owns CALL/CALLRESULT/CALLERROR framing, ocpp1.6
 * subprotocol negotiation, and official OCA schema validation — this class
 * only implements the specific message handling Kelo's product needs.
 *
 * Kelo's authorization model (per the product doc): the driver confirms
 * in-app, the backend sends RemoteStartTransaction — there is no
 * local/offline start path here, so a charge point starting a transaction
 * with no corresponding pending remote-start is rejected outright.
 *
 * transactionId is always the same number as the Kelo Session.id that
 * transaction belongs to — this central system mints it (as OCPP 1.6
 * requires the CS to do, in its StartTransaction response) rather than
 * inventing a second id space to correlate against our own.
 */
@Injectable()
export class OcppCentralSystem implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OcppCentralSystem.name);
  private readonly server: RPCServer;
  private readonly clients = new Map<string, OcppClientConnection>(); // chargePointId -> live connection
  private readonly pendingStarts = new Map<string, PendingStart>(); // chargePointId -> awaiting its real StartTransaction
  private readonly pendingStops = new Map<number, PendingStop>(); // sessionId -> awaiting a backend-requested StopTransaction
  private readonly transactions = new Map<number, ActiveTransaction>(); // sessionId -> live meter state
  private readonly sessionByChargePoint = new Map<string, number>(); // chargePointId -> its active sessionId
  private readonly lastSeenAt = new Map<string, number>(); // chargePointId -> Date.now() of its last real message (any type)
  private readonly staleWarned = new Set<string>(); // chargePointId already flagged this staleness episode — avoids re-logging/re-finalizing every sweep tick
  private staleSweepTimer: ReturnType<typeof setInterval> | null = null;
  private readonly staleTimeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {
    this.staleTimeoutMs = this.config.get<number>("OCPP_STALE_TIMEOUT_MS", DEFAULT_STALE_TIMEOUT_MS);
    this.server = new RPCServer({ protocols: ["ocpp1.6"], strictMode: true });
    this.server.auth((accept) => {
      // Transport-level accept only — Charger.ocppChargePointId is what
      // actually gates whether a real session can be started against a
      // given identity (OcppChargerAdapter checks that), the same way
      // Enode's enodeChargerId gates its own adapter.
      accept();
    });
    this.server.on("client", (client: OcppClientConnection) => this.onClient(client));
  }

  async onModuleInit(): Promise<void> {
    const port = this.config.get<number>("OCPP_PORT", 9220);
    await this.server.listen(port);
    this.logger.log(`OCPP 1.6-J central system listening on ws://localhost:${port}`);
    this.staleSweepTimer = setInterval(() => this.sweepStaleConnections(), STALE_SWEEP_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.staleSweepTimer) clearInterval(this.staleSweepTimer);
    await this.server.close({});
  }

  /**
   * A charge point is "stale" once nothing real has been heard from it
   * (connected or not — a disconnected-and-never-reconnected charge point
   * and a still-connected-but-silent one are indistinguishable from here,
   * deliberately: both mean the same thing for reconciliation purposes)
   * for longer than staleTimeoutMs. With no active session, that's just a
   * warning — an idle charge point going quiet has no billing
   * consequence. With one, leaving it "active" forever would mean a
   * booking/session that never resolves and a driver whose elapsed time
   * (and, once overstay/idle rules kick in, cost) keeps climbing against
   * a meter reading frozen at whatever it last reported — so this
   * finalizes it, through the exact same ocpp.stop.unsolicited path a
   * real unsolicited StopTransaction already drives, using the last
   * known meter reading rather than fabricating one. SessionsService's
   * own endedAt guard makes this safe even if a delayed real
   * StopTransaction still arrives afterward from a charge point that
   * reconnects late.
   */
  private sweepStaleConnections(): void {
    const now = Date.now();
    for (const [chargePointId, lastSeen] of this.lastSeenAt) {
      if (now - lastSeen < this.staleTimeoutMs || this.staleWarned.has(chargePointId)) continue;
      this.staleWarned.add(chargePointId);

      const sessionId = this.sessionByChargePoint.get(chargePointId);
      if (sessionId === undefined) {
        this.logger.warn(`Charge point ${chargePointId} has gone silent for over ${this.staleTimeoutMs}ms — no active session, nothing to reconcile.`);
        continue;
      }

      const tx = this.transactions.get(sessionId);
      const meterState: MeterState = tx
        ? { kwh: +(tx.lastMeterKwh - tx.meterStartKwh).toFixed(3), seconds: Math.max(0, Math.floor((now - tx.startedAt.getTime()) / 1000)) }
        : { kwh: 0, seconds: 0 };
      this.logger.warn(
        `Charge point ${chargePointId} has gone silent for over ${this.staleTimeoutMs}ms with session ${sessionId} still active — finalizing from its last known reading (kwh=${meterState.kwh}) rather than leaving it in permanent limbo.`,
      );
      this.transactions.delete(sessionId);
      this.sessionByChargePoint.delete(chargePointId);
      this.events.emit("ocpp.stop.unsolicited", { sessionId, meterState });
    }
  }

  private touch(chargePointId: string): void {
    this.lastSeenAt.set(chargePointId, Date.now());
    this.staleWarned.delete(chargePointId); // a real message means whatever staleness episode was flagged is over
  }

  isConnected(chargePointId: string): boolean {
    return this.clients.has(chargePointId);
  }

  /**
   * Sends RemoteStartTransaction and waits for the charge point's own
   * subsequent, separate StartTransaction call — RemoteStartTransaction's
   * own CALLRESULT only means "I'll try to start", not "I started".
   */
  async remoteStart(chargePointId: string, sessionId: number, idTag: string): Promise<void> {
    const client = this.clients.get(chargePointId);
    if (!client) {
      throw new ServiceUnavailableException(`Charge point ${chargePointId} is not connected`);
    }
    if (this.pendingStarts.has(chargePointId)) {
      throw new ConflictException(`Charge point ${chargePointId} already has a remote start in progress`);
    }

    const started = new Promise<void>((resolve, reject) => {
      this.pendingStarts.set(chargePointId, { sessionId, resolve, reject });
      setTimeout(() => {
        if (this.pendingStarts.get(chargePointId)?.sessionId === sessionId) {
          this.pendingStarts.delete(chargePointId);
          reject(new GatewayTimeoutException("Charge point did not send StartTransaction in time"));
        }
      }, START_TIMEOUT_MS);
    });

    let response: OcppParams;
    try {
      response = await client.call("RemoteStartTransaction", { connectorId: 1, idTag });
    } catch (err) {
      this.pendingStarts.delete(chargePointId);
      throw new BadGatewayException(`RemoteStartTransaction failed: ${(err as Error).message}`);
    }
    if (response.status !== "Accepted") {
      this.pendingStarts.delete(chargePointId);
      throw new BadGatewayException(`Charge point rejected RemoteStartTransaction: ${response.status}`);
    }

    await started;
  }

  /**
   * Sends RemoteStopTransaction and waits for the charge point's own real
   * StopTransaction — same async two-step shape as remoteStart. The
   * resulting StopTransaction is matched to this waiter (not treated as
   * unsolicited) in onStopTransaction, so it does NOT also trigger
   * finalizeSessionFromChargePoint — the caller here (OcppChargerAdapter.stop,
   * via SessionsService.simulateUnplug) does that itself, same as every
   * other adapter.
   */
  async remoteStop(chargePointId: string, sessionId: number): Promise<MeterState> {
    const client = this.clients.get(chargePointId);
    if (!client) {
      throw new ServiceUnavailableException(`Charge point ${chargePointId} is not connected`);
    }

    const stopped = new Promise<MeterState>((resolve, reject) => {
      this.pendingStops.set(sessionId, { resolve, reject });
      setTimeout(() => {
        if (this.pendingStops.has(sessionId)) {
          this.pendingStops.delete(sessionId);
          reject(new GatewayTimeoutException("Charge point did not send StopTransaction in time"));
        }
      }, STOP_TIMEOUT_MS);
    });

    let response: OcppParams;
    try {
      response = await client.call("RemoteStopTransaction", { transactionId: sessionId });
    } catch (err) {
      this.pendingStops.delete(sessionId);
      throw new BadGatewayException(`RemoteStopTransaction failed: ${(err as Error).message}`);
    }
    if (response.status !== "Accepted") {
      this.pendingStops.delete(sessionId);
      throw new BadGatewayException(`Charge point rejected RemoteStopTransaction: ${response.status}`);
    }

    return stopped;
  }

  getMeterValueByChargePoint(chargePointId: string): MeterState | null {
    const sessionId = this.sessionByChargePoint.get(chargePointId);
    if (sessionId === undefined) return null;
    return this.getMeterValueBySession(sessionId);
  }

  private getMeterValueBySession(sessionId: number): MeterState | null {
    const tx = this.transactions.get(sessionId);
    if (!tx) return null;
    return {
      kwh: +(tx.lastMeterKwh - tx.meterStartKwh).toFixed(3),
      seconds: Math.max(0, Math.floor((Date.now() - tx.startedAt.getTime()) / 1000)),
    };
  }

  private onClient(client: OcppClientConnection): void {
    const chargePointId = client.identity;
    this.logger.log(`Charge point connected: ${chargePointId}`);
    this.clients.set(chargePointId, client);
    this.touch(chargePointId);

    client.handle("BootNotification", async ({ params }) => {
      this.touch(chargePointId);
      this.logger.log(`BootNotification from ${chargePointId}: ${params.chargePointVendor} ${params.chargePointModel}`);
      return { status: "Accepted", currentTime: new Date().toISOString(), interval: HEARTBEAT_INTERVAL_SECONDS };
    });

    client.handle("Heartbeat", async () => {
      this.touch(chargePointId);
      return { currentTime: new Date().toISOString() };
    });

    client.handle("StatusNotification", async ({ params }) => {
      this.touch(chargePointId);
      this.logger.log(`StatusNotification from ${chargePointId}: connector ${params.connectorId} -> ${params.status}`);
      return {};
    });

    client.handle("Authorize", async () => {
      this.touch(chargePointId);
      // Kelo's authorization decision already happened in-app before
      // RemoteStartTransaction was ever sent — any idTag reaching us here
      // is one we minted ourselves (see OcppChargerAdapter), so it's
      // accepted unconditionally rather than checked against a driver
      // database the way a real card-present flow would.
      return { idTagInfo: { status: "Accepted" } };
    });

    client.handle("StartTransaction", async ({ params }) => {
      this.touch(chargePointId);
      return this.onStartTransaction(chargePointId, params);
    });
    client.handle("StopTransaction", async ({ params }) => {
      this.touch(chargePointId);
      return this.onStopTransaction(chargePointId, params);
    });
    client.handle("MeterValues", async ({ params }) => {
      this.touch(chargePointId);
      return this.onMeterValues(chargePointId, params);
    });

    client.handle(async ({ method }) => {
      // Still a real, live message — proves the charge point isn't stale,
      // even though we don't understand this particular one.
      this.touch(chargePointId);
      this.logger.warn(`Unhandled OCPP method from ${chargePointId}: ${method}`);
      throw createRPCError("NotImplemented");
    });

    client.on("close", () => {
      this.logger.log(`Charge point disconnected: ${chargePointId}`);
      this.clients.delete(chargePointId);
      // transactions/sessionByChargePoint deliberately untouched — per
      // BACKEND-PLAN.md's reconnection note, the charge point's own meter
      // keeps counting internally regardless of the WebSocket link. Losing
      // the connection isn't losing the session; getMeterValue just serves
      // the last-known reading until (if) it reconnects with a fresh one.
    });
  }

  private onStartTransaction(chargePointId: string, params: OcppParams): OcppParams {
    const pending = this.pendingStarts.get(chargePointId);
    if (!pending) {
      // No local-start path in Kelo's model (see class doc) — a charge
      // point starting a transaction we never remotely requested has
      // nothing to attach it to.
      throw createRPCError("SecurityError", "No pending remote start for this charge point");
    }
    this.pendingStarts.delete(chargePointId);

    const sessionId = pending.sessionId;
    const meterStartKwh = Number(params.meterStart) / 1000; // OCPP meter register values are Wh
    const now = new Date();
    this.transactions.set(sessionId, { chargePointId, startedAt: now, meterStartKwh, lastMeterKwh: meterStartKwh });
    this.sessionByChargePoint.set(chargePointId, sessionId);

    pending.resolve();
    return { transactionId: sessionId, idTagInfo: { status: "Accepted" } };
  }

  private onStopTransaction(chargePointId: string, params: OcppParams): OcppParams {
    const sessionId = Number(params.transactionId); // == Session.id, since we minted it above
    const tx = this.transactions.get(sessionId);
    const meterStopKwh = Number(params.meterStop) / 1000;
    const meterState: MeterState = tx
      ? { kwh: +(meterStopKwh - tx.meterStartKwh).toFixed(3), seconds: Math.max(0, Math.floor((Date.now() - tx.startedAt.getTime()) / 1000)) }
      : { kwh: 0, seconds: 0 };

    this.transactions.delete(sessionId);
    this.sessionByChargePoint.delete(chargePointId);

    const pending = this.pendingStops.get(sessionId);
    if (pending) {
      // A backend-requested stop (OcppChargerAdapter.stop -> remoteStop) —
      // that caller's own SessionsService.simulateUnplug flow performs the
      // one canonical finalization; don't duplicate it here.
      this.pendingStops.delete(sessionId);
      pending.resolve(meterState);
    } else {
      // Unsolicited — a genuine physical unplug the charge point reported
      // on its own initiative, with nothing backend-side waiting for it.
      // This is the ONLY trigger for that case, so it must finalize the
      // session itself, through the same path everything else uses.
      this.events.emit("ocpp.stop.unsolicited", { sessionId, meterState });
    }

    return { idTagInfo: { status: "Accepted" } };
  }

  private onMeterValues(chargePointId: string, params: OcppParams): OcppParams {
    const sessionId: number | undefined = params.transactionId !== undefined ? Number(params.transactionId) : this.sessionByChargePoint.get(chargePointId);
    if (sessionId === undefined) return {};
    const tx = this.transactions.get(sessionId);
    if (!tx) return {};

    let updated = false;
    for (const mv of (params.meterValue ?? []) as OcppParams[]) {
      const sampledValues = (mv.sampledValue ?? []) as OcppParams[];
      const energySample = sampledValues.find((sv) => !sv.measurand || sv.measurand === "Energy.Active.Import.Register");
      if (!energySample) continue;
      // OCPP 1.6's default unit for this measurand is Wh when omitted.
      const kwh = Number(energySample.value) / (energySample.unit === "kWh" ? 1 : 1000);
      if (Number.isFinite(kwh)) {
        tx.lastMeterKwh = kwh;
        updated = true;
      }
    }

    if (updated) {
      // Same live-tick event MockChargerAdapter's timer and
      // EnodeChargerAdapter's webhook handler both emit — a real
      // charge-point-reported meter reading drives the exact same
      // WebSocket bridge to the app, not a separate/ignored path.
      void this.emitTick(sessionId);
    }

    return {};
  }

  private async emitTick(sessionId: number): Promise<void> {
    const tx = this.transactions.get(sessionId);
    if (!tx) return;

    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { booking: { include: { charger: true } } } });
    const charger = session?.booking.charger;
    if (!charger) return;

    const { kwh, seconds } = this.getMeterValueBySession(sessionId) ?? { kwh: 0, seconds: 0 };
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
}
