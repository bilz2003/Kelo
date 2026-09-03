import React, { createContext, useCallback, useContext, useState } from "react";
import { Charger } from "@kelo/core";
import { defaultListingName } from "@/data/mockChargers";
import {
  getDiscoverChargers,
  mapDiscoverCharger,
  getMyChargers,
  mapOwnerCharger,
  setChargerAvailability,
  patchCharger,
  deleteCharger,
  ChargerWriteFields,
  MyCharger,
} from "@/api/chargers";
import { ApiError } from "@/api/client";

export const namesMatch = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The host-chosen display name, or the default fallback — a plain
// function of the charger's own real listingName field now (persisted via
// PATCH, see EditChargerScreen), not local-only state that reset on
// reload. Kept as a value on the context (rather than moved to
// @kelo/core) purely so every existing call site (useChargerStore().nameFor)
// stays unchanged.
export const nameFor = (c: Pick<Charger, "host" | "listingName">): string => {
  const custom = c.listingName;
  return custom && custom.trim() ? custom : defaultListingName(c);
};

interface ChargerStoreValue {
  chargers: Charger[]; // real chargers from GET /chargers/discover (Discover)
  chargersLoading: boolean;
  chargersError: string | null;
  refetchChargers: (radiusMiles?: number, coords?: { lat: number; lng: number }) => Promise<void>;
  myChargers: MyCharger[]; // real chargers from GET /chargers (owner-scoped)
  myChargersLoading: boolean;
  myChargersError: string | null;
  // ownerName: GET /chargers has no owner.name to derive host/initials from
  // (the caller already knows who they are) — the caller passes the
  // signed-in user's own name in, same as AuthContext already exposes it.
  refetchMyChargers: (ownerName: string) => Promise<void>;
  toggleChargerAvailability: (id: number) => Promise<void>;
  updateCharger: (id: number, patch: Partial<ChargerWriteFields>) => Promise<void>;
  removeCharger: (id: number) => Promise<void>;
  nameFor: (c: Charger) => string;
  siblingNames: (excludeId: number | null) => string[];
}

const ChargerStoreContext = createContext<ChargerStoreValue | undefined>(undefined);

export function ChargerStoreProvider({ children }: { children: React.ReactNode }) {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [chargersLoading, setChargersLoading] = useState(true);
  const [chargersError, setChargersError] = useState<string | null>(null);
  const refetchChargers = useCallback(async (radiusMiles?: number, coords?: { lat: number; lng: number }) => {
    setChargersLoading(true);
    setChargersError(null);
    try {
      const data = await getDiscoverChargers(radiusMiles, coords);
      setChargers(data.map(mapDiscoverCharger));
    } catch (err) {
      setChargersError(err instanceof ApiError ? err.message : "Couldn't load chargers — check your connection and try again.");
    } finally {
      setChargersLoading(false);
    }
  }, []);

  const [myChargers, setMyChargers] = useState<MyCharger[]>([]);
  const [myChargersLoading, setMyChargersLoading] = useState(true);
  const [myChargersError, setMyChargersError] = useState<string | null>(null);
  const refetchMyChargers = useCallback(async (ownerName: string) => {
    setMyChargersLoading(true);
    setMyChargersError(null);
    try {
      const data = await getMyChargers();
      setMyChargers(data.map((oc) => mapOwnerCharger(oc, ownerName)));
    } catch (err) {
      setMyChargersError(err instanceof ApiError ? err.message : "Couldn't load your chargers — check your connection and try again.");
    } finally {
      setMyChargersLoading(false);
    }
  }, []);

  // Optimistic: flips locally first so the toggle feels instant, then
  // confirms against the real PATCH — reverted on failure rather than
  // left showing a state the backend never actually accepted.
  const toggleChargerAvailability = useCallback(
    async (id: number) => {
      const current = myChargers.find((c) => c.id === id);
      if (!current) return;
      const next = !current.available;
      setMyChargers((prev) => prev.map((c) => (c.id === id ? { ...c, available: next } : c)));
      try {
        await setChargerAvailability(id, next);
      } catch (err) {
        setMyChargers((prev) => prev.map((c) => (c.id === id ? { ...c, available: !next } : c)));
        throw err;
      }
    },
    [myChargers],
  );

  // Not optimistic (unlike the toggle above) — a patch can touch several
  // fields at once (pricing, cable, listing name, photos) and re-geocode
  // on the backend if postcode changes, so waiting for the real response
  // and mapping that is more honest than guessing at the merged result.
  // Reuses the existing entry's own `host` for the re-map — editing a
  // charger never changes who owns it, so there's no need to ask the
  // caller for the owner's name again just to patch one field.
  const updateCharger = useCallback(async (id: number, patch: Partial<ChargerWriteFields>) => {
    const updated = await patchCharger(id, patch);
    setMyChargers((prev) => prev.map((c) => (c.id === id ? mapOwnerCharger(updated, c.host) : c)));
  }, []);

  const removeCharger = useCallback(async (id: number) => {
    await deleteCharger(id);
    setMyChargers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const siblingNames = (excludeId: number | null) => myChargers.filter((c) => c.id !== excludeId).map((c) => nameFor(c));

  return (
    <ChargerStoreContext.Provider
      value={{
        chargers,
        chargersLoading,
        chargersError,
        refetchChargers,
        myChargers,
        myChargersLoading,
        myChargersError,
        refetchMyChargers,
        toggleChargerAvailability,
        updateCharger,
        removeCharger,
        nameFor,
        siblingNames,
      }}
    >
      {children}
    </ChargerStoreContext.Provider>
  );
}

export function useChargerStore(): ChargerStoreValue {
  const ctx = useContext(ChargerStoreContext);
  if (!ctx) throw new Error("useChargerStore must be used within a ChargerStoreProvider");
  return ctx;
}
