-- Runs once, the first time the database volume is created.

CREATE TABLE vehicles (
  vehicle_id TEXT PRIMARY KEY,
  last_seen  TIMESTAMPTZ NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lon        DOUBLE PRECISION NOT NULL,
  speed_kmh  DOUBLE PRECISION,
  status     TEXT NOT NULL CHECK (status IN ('moving', 'stopped'))
);

CREATE TABLE trips (
  id         BIGSERIAL PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ NOT NULL,
  start_lat  DOUBLE PRECISION NOT NULL,
  start_lon  DOUBLE PRECISION NOT NULL,
  end_lat    DOUBLE PRECISION NOT NULL,
  end_lon    DOUBLE PRECISION NOT NULL,
  distance_m DOUBLE PRECISION NOT NULL
);
CREATE INDEX trips_vehicle_started ON trips (vehicle_id, started_at);

CREATE TABLE stops (
  id         BIGSERIAL PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lon        DOUBLE PRECISION NOT NULL
);
CREATE INDEX stops_vehicle_started ON stops (vehicle_id, started_at);

CREATE TABLE geofence_events (
  id          BIGSERIAL PRIMARY KEY,
  vehicle_id  TEXT NOT NULL,
  geofence_id TEXT NOT NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN ('enter', 'exit')),
  occurred_at TIMESTAMPTZ NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lon         DOUBLE PRECISION NOT NULL
);
CREATE INDEX geofence_events_time ON geofence_events (occurred_at);