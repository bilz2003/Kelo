-- Confirmed no existing duplicate enodeChargerId values before adding
-- this (real query against the real DB, not assumed) — a real device
-- should only ever be tied to exactly one Charger row once the real
-- Enode Link flow is what creates that link, not a default/manual value.
-- Postgres allows any number of NULLs under a unique index, so chargers
-- on other connection routes are unaffected.
CREATE UNIQUE INDEX "Charger_enodeChargerId_key" ON "Charger"("enodeChargerId");
