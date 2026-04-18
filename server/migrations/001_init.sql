-- Initial schema for the Sussex Police CCTV registry.
-- Ports the Firestore collections documented in firebase-blueprint.json to
-- Postgres and preserves the validation rules encoded in firestore.rules.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT NOT NULL UNIQUE,
  display_name  TEXT,
  role          TEXT NOT NULL CHECK (role IN ('admin','user','viewer')) DEFAULT 'viewer',
  status        TEXT NOT NULL CHECK (status IN ('pending','approved')) DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cameras (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                      TEXT NOT NULL CHECK (type IN ('cctv','police_council','pfs','other')),
  name                      TEXT,
  address                   TEXT,
  owner_name                TEXT,
  police_reference_number   TEXT,
  latitude                  DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude                 DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  direction                 DOUBLE PRECISION CHECK (direction IS NULL OR (direction >= 0 AND direction < 360)),
  field_of_view             DOUBLE PRECISION CHECK (field_of_view IS NULL OR (field_of_view > 0 AND field_of_view <= 360)),
  view_distance             DOUBLE PRECISION CHECK (view_distance IS NULL OR (view_distance > 0 AND view_distance <= 10000)),
  added_by                  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  creator_email             CITEXT NOT NULL,
  last_verified_at          TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cameras_added_by    ON cameras(added_by);
CREATE INDEX IF NOT EXISTS idx_cameras_created_at  ON cameras(created_at DESC);

-- added_by is immutable at the DB layer in addition to the app layer.
CREATE OR REPLACE FUNCTION cameras_protect_added_by() RETURNS trigger AS $$
BEGIN
  IF NEW.added_by IS DISTINCT FROM OLD.added_by THEN
    RAISE EXCEPTION 'cameras.added_by is immutable';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cameras_protect_added_by ON cameras;
CREATE TRIGGER trg_cameras_protect_added_by
BEFORE UPDATE ON cameras
FOR EACH ROW EXECUTE FUNCTION cameras_protect_added_by();

CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action        TEXT NOT NULL,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email    CITEXT NOT NULL,
  details       TEXT,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);

-- Events are append-only: reject UPDATE/DELETE at the DB layer.
CREATE OR REPLACE FUNCTION events_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'events rows are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_block_update ON events;
CREATE TRIGGER trg_events_block_update
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION events_block_mutation();

DROP TRIGGER IF EXISTS trg_events_block_delete ON events;
CREATE TRIGGER trg_events_block_delete
BEFORE DELETE ON events
FOR EACH ROW EXECUTE FUNCTION events_block_mutation();
