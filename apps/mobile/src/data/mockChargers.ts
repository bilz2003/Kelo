import { Charger, ChargerModelOption } from "@kelo/core";

// Supported charger models, matching the two integration routes from the
// product doc: direct OCPP 1.6-J vs the Enode aggregator.
export const CHARGER_MODELS: ChargerModelOption[] = [
  { title: "Ohme Home Pro", power: "7.4kW", powerNum: 7.4, route: "enode" },
  { title: "Wallbox Pulsar Plus", power: "7.4kW", powerNum: 7.4, route: "ocpp" },
  { title: "Zaptec Go", power: "7.4kW", powerNum: 7.4, route: "ocpp" },
  { title: "Easee One", power: "22kW", powerNum: 22, route: "ocpp" },
  { title: "Hypervolt Home 3", power: "7.4kW", powerNum: 7.4, route: "ocpp" },
  { title: "EO Mini Pro 3", power: "7kW", powerNum: 7, route: "ocpp" },
  { title: "myenergi Zappi", power: "7kW", powerNum: 7, route: "ocpp" },
  { title: "Pod Point Solo 3", power: "7kW", powerNum: 7, route: "enode" },
];

export const ROUTE_NOTES: Record<ChargerModelOption["route"], string> = {
  ocpp: "Connects via direct OCPP. Enable OCPP mode in your charger's own app first, then point it at Kelo.",
  enode: "Connects via Enode. Tap Connect and sign in with your existing charger account — no new login needed.",
};

export const defaultListingName = (c: Pick<Charger, "host">) => `${c.host}'s driveway`;
