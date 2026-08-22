import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Charger, ListingNameMap } from "@kelo/core";
import { CHARGERS, defaultListingName } from "@/data/mockChargers";
import { getDiscoverChargers, mapDiscoverCharger, getMyChargers, mapOwnerCharger, setChargerAvailability } from "@/api/chargers";
import { ApiError } from "@/api/client";

export const namesMatch = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface ChargerStoreValue {
  chargers: Charger[]; // real chargers from GET /chargers/discover (Discover)
  chargersLoading: boolean;
  chargersError: string | null;
  refetchChargers: (radiusMiles?: number) => Promise<void>;
  myChargers: Charger[]; // real chargers from GET /chargers (owner-scoped), with local overrides applied
  myChargersLoading: boolean;
  myChargersError: string | null;
  // ownerName: GET /chargers has no owner.name to derive host/initials from
  // (the caller already knows who they are) — the caller passes the
  // signed-in user's own name in, same as AuthContext already exposes it.
  refetchMyChargers: (ownerName: string) => Promise<void>;
  toggleChargerAvailability: (id: number) => Promise<void>;
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
  // CHARGERS/overrides/addedChargers machinery below.
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

  // My Chargers is real backend data too (GET /chargers, owner-scoped) —
  // myChargersBase holds it raw; overrides/removedIds (below) still apply
  // on top, exactly as they did over the old mock array, so Edit/Remove
  // Charger keep behaving the same way they always have (visible within
  // the session, not persisted — that was already true before this, for
  // every field except availability, which now really does persist; see
  // toggleChargerAvailability). Add Charger's addedChargers is
  // deliberately NOT merged in here — see the comment on myChargers below.
  const [myChargersBase, setMyChargersBase] = useState<Charger[]>([]);
  const [myChargersLoading, setMyChargersLoading] = useState(true);
  const [myChargersError, setMyChargersError] = useState<string | null>(null);
  const refetchMyChargers = useCallback(async (ownerName: string) => {
    setMyChargersLoading(true);
    setMyChargersError(null);
    try {
      const data = await getMyChargers();
      setMyChargersBase(data.map((oc) => mapOwnerCharger(oc, ownerName)));
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
      const current = myChargersBase.find((c) => c.id === id);
      if (!current) return;
      const next = !current.available;
      setMyChargersBase((prev) => prev.map((c) => (c.id === id ? { ...c, available: next } : c)));
      try {
        await setChargerAvailability(id, next);
      } catch (err) {
        setMyChargersBase((prev) => prev.map((c) => (c.id === id ? { ...c, available: !next } : c)));
        throw err;
      }
    },
    [myChargersBase],
  );

  const nameFor = (c: Charger) => {
    const custom = listingNames[c.id];
    return custom && custom.trim() ? custom : defaultListingName(c);
  };
  const setNameFor = (id: number, value: string) => setListingNames((prev) => ({ ...prev, [id]: value }));

  const effectiveCharger = (c: Charger): Charger => ({ ...c, ...(overrides[c.id] || {}) });
  const updateCharger = (id: number, patch: Partial<Charger>) =>
    setOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  // Unfiltered history — used for id generation, so a removed charger's id
  // is never reissued to a new one. Still mock-only: Add Charger writes
  // here, not to the backend (out of scope this pass) — see the comment
  // on myChargers below for what that means for the real list.
  const allChargersEver = useMemo(() => [...CHARGERS, ...addedChargers], [addedChargers]);
  const isRemoved = (id: number) => removedIds.includes(id);

  // Deliberately real-data-only: addedChargers (from the still-mock Add
  // Charger flow) is NOT merged in. Its ids are locally generated
  // (Math.max of the mock catalog + whatever's been added) and have no
  // relationship to real backend ids — blending the two risks a real
  // charger and a fake one sharing an id, and would make an unsaved mock
  // addition look identically "real" as something actually persisted.
  // Concretely: right now, adding a charger via Add Charger has no visible
  // effect on this list at all — it appends to addedChargers, which
  // nothing here reads. Wiring Add Charger to a real POST /chargers call
  // is the fix, and is its own separate pass.
  const myChargers = useMemo(
    () => myChargersBase.filter((c) => !isRemoved(c.id)).map(effectiveCharger),
    [myChargersBase, removedIds, overrides]
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
        myChargersLoading,
        myChargersError,
        refetchMyChargers,
        toggleChargerAvailability,
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
