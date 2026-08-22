export interface Charger {
  id: number;
  host: string;
  initials: string;
  postcode: string;
  fullAddress?: string; // private — only revealed once a booking is confirmed and paid
  title: string;
  power: string; // display string, e.g. "7.4kW"
  powerNum: number; // numeric kW, for calculations
  cable: "Tethered cable" | "Bring your own cable";
  connector: string;
  rate: number; // £/kWh, public
  overstayRate: number; // £/min, after the booking's agreed end time + 15 min grace
  idleRate: number; // £/min, after charging finishes + 15 min grace, within the booked window
  noShowFee: number; // £ flat, late-cancellation/no-show
  hostCost?: number; // private — host's own £/kWh cost, for their profit tracking
  distance: string; // display string, e.g. "0.4 mi" — real app: computed from geocoded location
  rating: number | null; // null = no sessions yet ("New listing")
  sessions: number;
  available: boolean; // whether the host currently accepts bookings on this charger
  photos?: string[]; // up to 2, data URLs on web; local URIs from expo-image-picker on native
}

export type ListingNameMap = Record<number, string>;

export interface ChargerModelOption {
  title: string;
  power: string;
  powerNum: number;
  route: "ocpp" | "enode";
}

export interface BookingDetails {
  arrival: Date;
  endTime: Date;
  durationHours: number;
  estKwh: string;
  estCost: string;
}

export interface Booking {
  id: number;
  title: string;
  host: string;
  date: string; // display string
  status: "Upcoming" | "Completed" | "Cancelled" | "No show";
  cost: string | null;
  dateISO: string; // "YYYY-MM-DD"
}

export interface TimeRangeValue {
  mode: "month" | "range" | "all";
  start: Date;
  end: Date;
  label: string;
}

export interface SessionFinancials {
  idleChargesActive: boolean;
  idleMinutesElapsed: number;
  idleCost: number;
  overstayActive: boolean;
  overstayMinutesElapsed: number;
  overstayCost: number;
  energyCost: number;
  totalCost: number; // what the driver is actually charged — gross
  hostNet: number; // what the host actually receives, after Kelo's commission
}
