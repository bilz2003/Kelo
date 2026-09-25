import { Charger, ChargerModelOption, defaultListingName as coreDefaultListingName } from "@kelo/core";

// Supported charger models, matching the two integration routes from the
// product doc: direct OCPP 1.6-J vs the Enode aggregator.
// Ohme and Pod Point are disabled (not deleted) pending their response —
// see ENODE-INTEGRATION.md and the underlying Link flow, which is
// untouched and already works for both; only the picker hides them.
// Re-enabling either the moment they respond is a one-line flip below.
export const CHARGER_MODELS: ChargerModelOption[] = [
  { title: "Ohme Home Pro", power: "7.4kW", powerNum: 7.4, route: "enode", enabled: false },
  { title: "Wallbox Pulsar Plus", power: "7.4kW", powerNum: 7.4, route: "ocpp", enabled: true },
  { title: "Zaptec Go", power: "7.4kW", powerNum: 7.4, route: "ocpp", enabled: true },
  { title: "Easee One", power: "22kW", powerNum: 22, route: "ocpp", enabled: true },
  { title: "Hypervolt Home 3", power: "7.4kW", powerNum: 7.4, route: "ocpp", enabled: true },
  { title: "EO Mini Pro 3", power: "7kW", powerNum: 7, route: "ocpp", enabled: true },
  { title: "myenergi Zappi", power: "7kW", powerNum: 7, route: "ocpp", enabled: true },
  { title: "Pod Point Solo 3", power: "7kW", powerNum: 7, route: "enode", enabled: false },
];

export const ROUTE_NOTES: Record<ChargerModelOption["route"], string> = {
  ocpp: "Connects via direct OCPP. Get your connection details below, enter them into your charger's own OCPP settings, then confirm once it's online.",
  enode: "Connects via Enode. Tap Connect and sign in with your existing charger account — no new login needed.",
};

// c.host is the host's FIRST name (see mapDiscoverCharger / ownerIdentityOf) — the wording itself lives in @kelo/core so web and mobile can't drift.
export const defaultListingName = (c: Pick<Charger, "host">) => coreDefaultListingName(c.host);
