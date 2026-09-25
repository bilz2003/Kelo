"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { defaultListingName, deriveIdleAndOverstayRates } from "@kelo/core";
import type { OwnerCharger } from "@/lib/types";

interface PhotoItem {
  key: string;
  url: string;
}

const RATE = { min: 0.1, max: 1 };
const FEE = { min: 1, max: 10 };
const COST = { min: 0, max: 1 };

const asPhotos = (c: OwnerCharger): PhotoItem[] => c.photoKeys.map((key, i) => ({ key, url: c.photos[i] ?? "" }));
const money = (n: number) => n.toFixed(2);

function parseIn(raw: string, { min, max }: { min: number; max: number }): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function MoneyField(props: {
  id: string; label: string; unit: string; value: string; onChange?: (v: string) => void;
  helper: string; error?: string | null; readOnly?: boolean; placeholder?: string;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={props.id}>{props.label}</label>
      <div className={`money-input${props.readOnly ? " readonly" : ""}`}>
        <span>£</span>
        <input
          id={props.id} inputMode="decimal" value={props.value} readOnly={props.readOnly}
          placeholder={props.placeholder} onChange={(e) => props.onChange?.(e.target.value)} aria-invalid={!!props.error}
        />
        <span className="unit">/ {props.unit}</span>
      </div>
      {props.error ? <span className="hint danger">{props.error}</span> : <span className="hint">{props.helper}</span>}
    </div>
  );
}

export function EditChargerForm({ charger, ownerFirstName }: { charger: OwnerCharger; ownerFirstName: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(charger); // last state the server confirmed

  const [name, setName] = useState(charger.listingName ?? "");
  const [tethered, setTethered] = useState(charger.cable === "TETHERED");
  const [rate, setRate] = useState(money(charger.rate));
  const [fee, setFee] = useState(money(charger.noShowFee));
  const [cost, setCost] = useState(charger.hostCost === null ? "" : money(charger.hostCost));
  const [photos, setPhotos] = useState<PhotoItem[]>(asPhotos(charger));

  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rateNum = parseIn(rate, RATE);
  const feeNum = parseIn(fee, FEE);
  const costNum = parseIn(cost, COST);
  const rateError = rateNum === null ? `Enter a rate between £${money(RATE.min)} and £${money(RATE.max)}.` : null;
  const feeError = feeNum === null ? `Enter a fee between £${money(FEE.min)} and £${money(FEE.max)}.` : null;
  const costError = cost.trim() !== "" && costNum === null ? `Enter a cost between £${money(COST.min)} and £${money(COST.max)}, or leave it blank.` : null;
  const valid = !rateError && !feeError && !costError;

  // Live preview only — the server derives and stores the real values, from
  // this same shared formula, when the rate is saved.
  const { idleRate, overstayRate } = deriveIdleAndOverstayRates(rateNum ?? saved.rate, saved.powerKw);

  const trimmedName = name.trim();
  const savedKeys = saved.photoKeys.join("|");
  const dirty =
    trimmedName !== (saved.listingName ?? "") ||
    tethered !== (saved.cable === "TETHERED") ||
    (rateNum ?? NaN) !== saved.rate ||
    (feeNum ?? NaN) !== saved.noShowFee ||
    (costNum ?? null) !== saved.hostCost ||
    photos.map((p) => p.key).join("|") !== savedKeys;

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after a removal
    if (!file || photos.length >= 2) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/chargers/photos", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? "Photo upload failed — try again.");
      setPhotos((p) => [...p, { key: data.key as string, url: URL.createObjectURL(file) }]);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Photo upload failed — try again.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!valid || !dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    setSavedNote(false);

    const patch: Record<string, unknown> = {};
    if (trimmedName !== (saved.listingName ?? "")) patch.listingName = trimmedName === "" ? null : trimmedName; // null resets to the default name
    if (tethered !== (saved.cable === "TETHERED")) patch.cable = tethered ? "TETHERED" : "BRING_YOUR_OWN";
    if (rateNum !== saved.rate) patch.rate = rateNum;
    if (feeNum !== saved.noShowFee) patch.noShowFee = feeNum;
    if ((costNum ?? null) !== saved.hostCost) patch.hostCost = costNum;
    if (photos.map((p) => p.key).join("|") !== savedKeys) patch.photos = photos.map((p) => p.key);

    try {
      const res = await fetch(`/api/chargers/${charger.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(", ") : (data?.message ?? "Couldn't save your changes — try again."));
      const next = data as OwnerCharger;
      setSaved(next);
      setPhotos(asPhotos(next)); // swap local previews for the server's fresh presigned URLs
      setSavedNote(true);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save your changes — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/chargers/${charger.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Couldn't remove this charger — try again.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Couldn't remove this charger — try again.");
      setRemoving(false);
    }
  }

  const defaultName = defaultListingName(ownerFirstName);

  return (
    <div>
      <section className="form-section">
        <span className="label">Listing</span>
        <div className="field" style={{ maxWidth: 460 }}>
          <label className="label" htmlFor="listing-name">Listing name</label>
          <input id="listing-name" className="input" value={name} maxLength={40} placeholder={defaultName} onChange={(e) => setName(e.target.value)} />
          <span className="hint">What drivers see on Discover. Clear the field to reset it to &ldquo;{defaultName}&rdquo;.</span>
        </div>

        <div className="field">
          <span className="label">Photos</span>
          <div className="photo-grid">
            {[0, 1].map((slot) => {
              const p = photos[slot];
              if (p) {
                return (
                  <div className="photo-slot filled" key={p.key}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Charger photo ${slot + 1}`} />
                    <button type="button" className="remove" aria-label={`Remove photo ${slot + 1}`} onClick={() => setPhotos((all) => all.filter((x) => x.key !== p.key))}>×</button>
                  </div>
                );
              }
              const isNext = slot === photos.length;
              return (
                <label className="photo-slot" key={`empty-${slot}`} aria-disabled={!isNext} style={isNext ? undefined : { opacity: 0.4, cursor: "not-allowed" }}>
                  {isNext && uploading ? <span className="spinner" aria-label="Uploading" /> : <span>Add photo</span>}
                  {isNext && (
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickFile} disabled={uploading} aria-label="Choose a photo to upload" />
                  )}
                </label>
              );
            })}
          </div>
          {photoError ? <span className="hint danger" role="alert">{photoError}</span> : <span className="hint">Up to 2 photos of the space — JPEG, PNG or WebP, up to 8 MB each. Listings with photos help drivers picture where they&rsquo;re pulling up.</span>}
        </div>

        <div className="toggle-card" style={{ maxWidth: 460 }}>
          <div>
            <div style={{ fontWeight: 500 }}>Cable</div>
            <div className="hint">{tethered ? "You provide the tethered cable" : "Drivers bring their own cable"}</div>
          </div>
          <button type="button" role="switch" aria-checked={tethered} className="switch" onClick={() => setTethered((t) => !t)} aria-label="You provide a tethered cable">
            <span className="track"><span className="thumb" /></span>
          </button>
        </div>
      </section>

      <section className="form-section" style={{ maxWidth: 460 }}>
        <span className="label">Pricing &amp; fees</span>
        <MoneyField id="rate" label="Charging rate — shown publicly" unit="kWh" value={rate} onChange={setRate} error={rateError} helper="What drivers compare between hosts. Kelo takes a 12% commission on this." />
        <MoneyField id="idle" label="Idle occupancy rate — from the moment charging finishes" unit="min" value={idleRate.toFixed(4)} readOnly helper="Set automatically at 1.5× your charging rate. Kelo takes a 12% commission." />
        <MoneyField id="overstay" label="Overstay rate — after 15 min grace" unit="min" value={overstayRate.toFixed(4)} readOnly helper="Set automatically at 7× your charging rate. Kelo takes a 30% commission." />
        <MoneyField id="fee" label="Late-cancellation / no-show fee" unit="booking" value={fee} onChange={setFee} error={feeError} helper="Paid to you in full — Kelo takes no commission on this one. Range £1.00–£10.00." />
      </section>

      <section className="form-section" style={{ maxWidth: 460 }}>
        <span className="label">Private — only visible to you</span>
        <MoneyField id="cost" label="Your electricity cost" unit="kWh" value={cost} onChange={setCost} error={costError} placeholder="Not set" helper="Optional. Lets Kelo show your real profit per session. Never shown to drivers. On a time-of-use tariff? Enter your average rate." />
      </section>

      <div className="savebar">
        <button className="btn btn-primary" onClick={save} disabled={!valid || !dirty || saving || uploading}>{saving ? "Saving…" : "Save changes"}</button>
        <span className="status">
          {saveError ? <span className="danger" role="alert">{saveError}</span> : savedNote && !dirty ? <span>Saved.</span> : dirty ? <span className="soft">Unsaved changes</span> : null}
        </span>
      </div>

      <section className="form-section" style={{ marginTop: 40, maxWidth: 460 }}>
        <span className="label">Remove charger</span>
        {!confirmingRemove ? (
          <button className="btn btn-danger" onClick={() => setConfirmingRemove(true)}>Remove this charger</button>
        ) : (
          <div className="confirm-box">
            <p className="soft" style={{ fontSize: 14, marginBottom: 14 }}>
              Remove <b style={{ color: "var(--text)", fontWeight: 500 }}>{trimmedName || defaultName}</b>? It&rsquo;ll disappear from Discover immediately and this can&rsquo;t be undone.
              Any upcoming bookings on it are cancelled automatically, free of charge to the driver.
            </p>
            {removeError && <p className="form-error">{removeError}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmingRemove(false)} disabled={removing}>Cancel</button>
              <button className="btn btn-solid-danger btn-sm" onClick={remove} disabled={removing}>{removing ? "Removing…" : "Remove"}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
