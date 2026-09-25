// Shapes of the backend responses this app consumes. Mirrors
// apps/backend (auth.service.ts, chargers.service.ts) — not re-derived.

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** GET /chargers and GET /chargers/:id — the owner-scoped shape. */
export interface OwnerCharger {
  id: number;
  ownerId: number;
  postcode: string;
  fullAddress: string | null;
  title: string;
  listingName: string | null;
  powerKw: number;
  cable: "TETHERED" | "BRING_YOUR_OWN";
  connector: string;
  rate: number;
  overstayRate: number;
  idleRate: number;
  noShowFee: number;
  hostCost: number | null;
  connectionRoute: "OCPP" | "ENODE" | "MOCK";
  available: boolean;
  createdAt: string;
  photos: string[]; // presigned view URLs
  photoKeys: string[]; // raw S3 keys, parallel to photos
}

export interface ChargerStats {
  sessions: number;
  kwh: number;
  earned: number;
}
