import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Charger, ListingNameMap } from "@kelo/core";
import { CHARGERS, defaultListingName } from "@/data/mockChargers";
import { getDiscoverChargers, mapDiscoverCharger } from "@/api/chargers";
import { ApiError } from "@/api/client";

export const namesMatch = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface ChargerStoreValue {
  chargers: Charger[]; // real chargers from GET /chargers/discover (Discover)
  chargersLoading: boolean;
  chargersError: string | null;
  refetchChargers: (radiusMiles?: number) => Promise<void>;
  myChargers: Charger[]; // this host's own chargers, with overrides applied — still mock, Add/Edit Charger is a later pass
  hostIdentity: { host: string; initials: string };
  nameFor: (c: Charger) => string;
  setNameFor: (id: number, value: string) => void;
  updateCharger: (id: number, patch: Partial<Charger>) => void;
  addCharger: (base: Omit<Charger, "id">, name: string) => void;
  removeCharger: (id: number) => void;
  siblingNames: (excludeId: number | null) => string[];
}

const ChargerStoreContext = createContext<ChargerStoreValue | undefined>(undefined);

export function ChargerStoreProvider({ children }: { children: React.ReactNode }) {
  const [listingNames, setListingNames] = useState<ListingNameMap>({});
  const [overrides, setOverrides] = useState<Record<number, Partial<Charger>>>({});
  const [addedChargers, setAddedChargers] = useState<Charger[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);

  // Discover is real backend data now — no relation to the mock
  // CHARGERS/overrides/addedChargers machinery below, which still drives
  // myChargers until Add/Edit Charger is wired to the backend too.
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [chargersLoading, setChargersLoading] = useState(true);
  const [chargersError, setChargersError] = useState<string | null>(null);
  const refetchChargers = useCallback(async (radiusMiles?: number) => {
    setChargersLoading(true);
    setChargersError(null);
    try {
      const data = await getDiscoverChargers(radiusMiles);
      setChargers(data.map(mapDiscoverCharger));
    } catch (err) {
      setChargersError(err instanceof ApiError ? err.message : "Couldn't load chargers — check your connection and try again.");
    } finally {
      setChargersLoading(false);
    }
  }, []);

  const nameFor = (c: Charger) => {
    const custom = listingNames[c.id];
    return custom && custom.trim() ? custom : defaultListingName(c);
  };
  const setNameFor = (id: number, value: string) => setListingNames((prev) => ({ ...prev, [id]: value }));

  const effectiveCharger = (c: Charger): Charger => ({ ...c, ...(overrides[c.id] || {}) });
  const updateCharger = (id: number, patch: Partial<Charger>) =>
    setOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  // Unfiltered history — used for id generation, so a removed charger's id
  // is never reissued to a new one.
  const allChargersEver = useMemo(() => [...CHARGERS, ...addedChargers], [addedChargers]);
  const isRemoved = (id: number) => removedIds.includes(id);

  const myChargers = useMemo(
    () => [CHARGERS[0], ...addedChargers].filter((c) => !isRemoved(c.id)).map(effectiveCharger),
    [addedChargers, removedIds, overrides]
  );
  const hostIdentity = { host: CHARGERS[0].host, initials: CHARGERS[0].initials };

  const siblingNames = (excludeId: number | null) => myChargers.filter((c) => c.id !== excludeId).map((c) => nameFor(c));

  const addCharger = (base: Omit<Charger, "id">, name: string) => {
    const id = Math.max(...allChargersEver.map((c) => c.id)) + 1;
    const newCharger: Charger = { id, ...base };

    let finalName = name;
    if (!finalName) {
      const existingNames = siblingNames(null);
      const base_ = defaultListingName(newCharger);
      let candidate = base_;
      let n = 2;
      while (existingNames.some((existing) => namesMatch(existing, candidate))) {
        candidate = `${base_} (${n})`;
        n++;
      }
      if (candidate !== base_) finalName = candidate;
    }

    setAddedChargers((prev) => [...prev, newCharger]);
    if (finalName) setNameFor(id, finalName);
  };

  const removeCharger = (id: number) => setRemovedIds((prev) => [...prev, id]);

  return (
    <ChargerStoreContext.Provider
      value={{
        chargers,
        chargersLoading,
        chargersError,
        refetchChargers,
        myChargers,
        hostIdentity,
        nameFor,
        setNameFor,
        updateCharger,
        addCharger,
        removeCharger,
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
