import { Charger, ChargerModelOption, defaultListingName as coreDefaultListingName } from "@kelo/core";

export const ROUTE_NOTES: Record<ChargerModelOption["route"], string> = {
  ocpp: "Connects via direct OCPP. Get your connection details below, enter them into your charger's own OCPP settings, then confirm once it's online.",
  enode: "Connects via Enode. Tap Connect and sign in with your existing charger account — no new login needed.",
};

// c.host is the host's FIRST name (see mapDiscoverCharger / ownerIdentityOf) — the wording itself lives in @kelo/core so web and mobile can't drift.
export const defaultListingName = (c: Pick<Charger, "host">) => coreDefaultListingName(c.host);
