/**
 * One interface, implemented once per real connection route (OCPP, Enode)
 * plus this mock — per BACKEND-PLAN.md §3, so booking/pricing logic never
 * branches on which protocol a charger actually speaks.
 */
export interface MeterState {
  kwh: number;
  seconds: number;
}

export interface ChargerAdapter {
  /** Starts a session on the charger. Maps to OCPP's StartTransaction. */
  authorize(sessionId: number): Promise<void>;
  /** Stops a session and returns its final meter reading. Maps to OCPP's StopTransaction. */
  stop(sessionId: number): Promise<MeterState>;
  /** Current meter reading for whatever session is active on this charger, if any. */
  getMeterValue(chargerId: number): Promise<MeterState | null>;
}

export const CHARGER_ADAPTER = Symbol("CHARGER_ADAPTER");
