import { Charger, ChargerModelOption } from "@kelo/core";

export const CHARGERS: Charger[] = [
  { id: 1, host: "James", initials: "JM", postcode: "SM5", fullAddress: "14 Elm Grove, Carshalton, SM5 2QT", title: "Ohme Home Pro", power: "7.4kW", powerNum: 7.4, cable: "Tethered cable", connector: "Type 2", rate: 0.34, overstayRate: 1.0, idleRate: 0.15, noShowFee: 3.0, distance: "0.4 mi", rating: 4.9, sessions: 32, available: true },
  { id: 2, host: "Priya", initials: "PS", postcode: "SM5", fullAddress: "27 Beddington Lane, Carshalton, SM5 4LT", title: "Wallbox Pulsar Plus", power: "7.4kW", powerNum: 7.4, cable: "Bring your own cable", connector: "Type 2", rate: 0.31, overstayRate: 1.0, idleRate: 0.15, noShowFee: 3.0, distance: "0.7 mi", rating: 4.8, sessions: 18, available: true },
  { id: 3, host: "Tom", initials: "TR", postcode: "SM4", fullAddress: "8 Central Road, Morden, SM4 5RT", title: "Zaptec Go", power: "11kW", powerNum: 11, cable: "Tethered cable", connector: "Type 2", rate: 0.36, overstayRate: 1.0, idleRate: 0.2, noShowFee: 3.0, distance: "1.1 mi", rating: 5.0, sessions: 9, available: true },
  { id: 4, host: "Aisha", initials: "AK", postcode: "SM5", fullAddress: "3 Ruskin Road, Carshalton, SM5 1JB", title: "Pod Point Solo 3", power: "7kW", powerNum: 7, cable: "Tethered cable", connector: "Type 2", rate: 0.29, overstayRate: 1.0, idleRate: 0.15, noShowFee: 3.0, distance: "1.3 mi", rating: 4.7, sessions: 41, available: true },
  { id: 5, host: "Michael", initials: "MC", postcode: "SM1", fullAddress: "52 Cheam Road, Sutton, SM1 2BD", title: "Easee One", power: "22kW", powerNum: 22, cable: "Tethered cable", connector: "Type 2", rate: 0.38, overstayRate: 1.25, idleRate: 0.25, noShowFee: 3.0, distance: "1.6 mi", rating: 4.9, sessions: 27, available: true },
  { id: 6, host: "Fatima", initials: "FH", postcode: "SM3", fullAddress: "19 Anton Crescent, Sutton, SM3 9EL", title: "Hypervolt Home 3", power: "7.4kW", powerNum: 7.4, cable: "Tethered cable", connector: "Type 2", rate: 0.3, overstayRate: 1.0, idleRate: 0.15, noShowFee: 2.5, distance: "1.8 mi", rating: 4.6, sessions: 14, available: true },
  { id: 7, host: "Daniel", initials: "DW", postcode: "SM6", fullAddress: "61 Manor Road, Wallington, SM6 0AH", title: "EO Mini Pro 3", power: "7kW", powerNum: 7, cable: "Bring your own cable", connector: "Type 2", rate: 0.28, overstayRate: 0.75, idleRate: 0.1, noShowFee: 3.0, distance: "2.0 mi", rating: 4.5, sessions: 6, available: true },
  { id: 8, host: "Grace", initials: "GO", postcode: "SM5", fullAddress: "45 Wrythe Lane, Carshalton, SM5 2RS", title: "myenergi Zappi", power: "7kW", powerNum: 7, cable: "Tethered cable", connector: "Type 2", rate: 0.33, overstayRate: 1.0, idleRate: 0.2, noShowFee: 3.5, distance: "2.2 mi", rating: 4.8, sessions: 22, available: true },
  { id: 9, host: "Oliver", initials: "OB", postcode: "SM2", fullAddress: "9 Worcester Road, Sutton, SM2 6PN", title: "Ohme Home Pro", power: "7.4kW", powerNum: 7.4, cable: "Tethered cable", connector: "Type 2", rate: 0.35, overstayRate: 1.0, idleRate: 0.15, noShowFee: 3.0, distance: "2.4 mi", rating: 5.0, sessions: 48, available: true },
  { id: 10, host: "Sana", initials: "SK", postcode: "CR4", fullAddress: "23 London Road, Mitcham, CR4 3JR", title: "Wallbox Pulsar Plus", power: "7.4kW", powerNum: 7.4, cable: "Tethered cable", connector: "Type 2", rate: 0.32, overstayRate: 1.0, idleRate: 0.15, noShowFee: 3.0, distance: "2.6 mi", rating: 4.7, sessions: 11, available: true },
  { id: 11, host: "Liam", initials: "LF", postcode: "SM7", fullAddress: "5 Court Road, Banstead, SM7 2BQ", title: "Zaptec Go", power: "7.4kW", powerNum: 7.4, cable: "Bring your own cable", connector: "Type 2", rate: 0.27, overstayRate: 0.5, idleRate: 0.1, noShowFee: 2.0, distance: "2.9 mi", rating: 4.6, sessions: 8, available: true },
  { id: 12, host: "Ruth", initials: "RN", postcode: "CR0", fullAddress: "71 Duppas Hill Road, Croydon, CR0 4BQ", title: "Pod Point Solo 3", power: "7kW", powerNum: 7, cable: "Tethered cable", connector: "Type 2", rate: 0.31, overstayRate: 1.0, idleRate: 0.15, noShowFee: 3.0, distance: "3.1 mi", rating: 4.9, sessions: 35, available: true },
  { id: 13, host: "Kwame", initials: "KA", postcode: "SM1", fullAddress: "16 Vernon Road, Sutton, SM1 4LF", title: "Easee One", power: "22kW", powerNum: 22, cable: "Tethered cable", connector: "Type 2", rate: 0.39, overstayRate: 1.5, idleRate: 0.25, noShowFee: 4.0, distance: "3.3 mi", rating: 5.0, sessions: 19, available: true },
  { id: 14, host: "Isla", initials: "IM", postcode: "SM3", fullAddress: "33 Sutton Common Road, Sutton, SM3 9PN", title: "Hypervolt Home 3", power: "7.4kW", powerNum: 7.4, cable: "Bring your own cable", connector: "Type 2", rate: 0.3, overstayRate: 1.0, idleRate: 0.15, noShowFee: 3.0, distance: "3.5 mi", rating: 4.4, sessions: 5, available: true },
];

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
