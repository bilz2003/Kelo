import { SESSION_FULL_AT_SECONDS } from "@kelo/core";
import { MeterState } from "./adapters/charger-adapter.interface";

/**
 * Same curve as apps/mobile/src/state/SessionContext.tsx's old local
 * simulation (perSecond rate, SESSION_FULL_AT_SECONDS cap) — computed from
 * elapsed wall-clock time since `startedAt` rather than an incrementally
 * ticked counter, so it's always correctly recomputable from a persisted
 * timestamp alone. That's what makes reconnect-after-restart and the
 * driver/host multi-subscriber guarantee correct: every subscriber, no
 * matter when it (re)connects, derives the same answer from the same
 * inputs instead of replaying a stream of prior ticks.
 */
export function computeMockMeterState(powerNum: number, startedAt: Date, now: Date = new Date()): MeterState {
  const perSecond = (powerNum / 3600) * 40; // accelerated for the live demo, same as the old client-side simulation
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
  const kwh = +(Math.min(elapsedSeconds, SESSION_FULL_AT_SECONDS) * perSecond).toFixed(3);
  return { kwh, seconds: elapsedSeconds };
}
