import React, { createContext, useContext, useMemo, useState } from "react";
import { Charger, ListingNameMap } from "@/types";
import { CHARGERS, defaultListingName } from "@/data/mockChargers";

const namesMatch = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface ChargerStoreValue {
  chargers: Charger[]; // all visible chargers (Discover), with overrides applied
  myChargers: Charger[]; // this host's own chargers, with overrides applied
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

  const chargers = useMemo(
    () => allChargersEver.filter((c) => !isRemoved(c.id)).map(effectiveCharger),
    [allChargersEver, removedIds, overrides]
  );
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
      value={{ chargers, myChargers, hostIdentity, nameFor, setNameFor, updateCharger, addCharger, removeCharger, siblingNames }}
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
