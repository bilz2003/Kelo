import { ChargerModelOption } from "./types";

// Supported charger models, matching the two integration routes from the
// product doc: direct OCPP 1.6-J vs the Enode aggregator.
// Ohme and Pod Point are disabled (not deleted) pending their response —
// see ENODE-INTEGRATION.md and the underlying Link flow, which is
// untouched and already works for both; only the pickers hide them.
// Re-enabling either the moment they respond is a one-line flip below —
// and it takes effect everywhere at once: the app's Add Charger picker and
// the website's "Chargers & fees" page both read this list.
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

/** The models a host can actually add right now — the one filter every surface uses. */
export const getEnabledChargerModels = (): ChargerModelOption[] => CHARGER_MODELS.filter((m) => m.enabled);
