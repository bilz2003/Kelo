import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { computeSessionFinancials } from "@kelo/core";
import { PrismaService } from "../../prisma/prisma.service";
import { toCoreCharger } from "../charger-mapping";
import { computeMockMeterState } from "../mock-meter";
import { ChargerAdapter, MeterState } from "./charger-adapter.interface";

const TICK_INTERVAL_MS = 1000;

export interface SessionTickEvent extends MeterState {
  sessionId: number;
  energyCost: number;
  idleCost: number;
  totalCost: number;
  idleChargesActive: boolean;
}

interface ActiveMockSession {
  chargerId: number;
  startedAt: Date;
  timer: ReturnType<typeof setInterval>;
}

/**
 * Predictable fake meter ticks, per BACKEND-PLAN.md §3's recommendation to
 * build against a mock/simulator implementation of ChargerAdapter first —
 * same interface real OCPP/Enode adapters will implement later, so nothing
 * downstream (bookings, the WebSocket bridge) has to change when they land.
 */
@Injectable()
export class MockChargerAdapter implements ChargerAdapter {
  private readonly active = new Map<number, ActiveMockSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async authorize(sessionId: number): Promise<void> {
    if (this.active.has(sessionId)) return; // already ticking — idempotent

    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: { booking: { include: { charger: true } } },
    });

    const { charger } = session.booking;
    const timer = setInterval(() => this.tick(sessionId), TICK_INTERVAL_MS);
    this.active.set(sessionId, { chargerId: charger.id, startedAt: session.startedAt, timer });
  }

  async stop(sessionId: number): Promise<MeterState> {
    const entry = this.active.get(sessionId);
    const finalState = entry
      ? computeMockMeterState(await this.powerNumFor(entry.chargerId), entry.startedAt)
      : { kwh: 0, seconds: 0 };

    if (entry) {
      clearInterval(entry.timer);
      this.active.delete(sessionId);
    }
    return finalState;
  }

  async getMeterValue(chargerId: number): Promise<MeterState | null> {
    for (const [, entry] of this.active) {
      if (entry.chargerId === chargerId) {
        return computeMockMeterState(await this.powerNumFor(chargerId), entry.startedAt);
      }
    }
    return null;
  }

  private async powerNumFor(chargerId: number): Promise<number> {
    const charger = await this.prisma.charger.findUniqueOrThrow({ where: { id: chargerId } });
    return charger.powerKw;
  }

  private async tick(sessionId: number): Promise<void> {
    const entry = this.active.get(sessionId);
    if (!entry) return;

    const charger = await this.prisma.charger.findUnique({ where: { id: entry.chargerId } });
    if (!charger) return;

    const { kwh, seconds } = computeMockMeterState(charger.powerKw, entry.startedAt);
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
