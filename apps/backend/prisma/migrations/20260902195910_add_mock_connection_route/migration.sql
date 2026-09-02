-- Existing chargers tagged OCPP were always actually driven by
-- MockChargerAdapter (there was no real OCPP central system until now) —
-- re-tag them MOCK so they keep behaving exactly as before. Split into
-- its own migration since Postgres won't let a newly-added enum value be
-- used in the same transaction that added it.
UPDATE "Charger" SET "connectionRoute" = 'MOCK' WHERE "connectionRoute" = 'OCPP';