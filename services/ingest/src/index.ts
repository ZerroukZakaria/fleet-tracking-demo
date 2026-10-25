import { connect } from "mqtt";
import pg from "pg";
import {
  DEMO_GEOFENCES,
  FleetPipeline,
  POSITION_TOPIC_FILTER,
  parsePosition,
  vehicleIdFromTopic,
  type GeofenceEvent,
  type Position,
  type Segment,
} from "@fleet/core";

const BROKER_URL = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
// Throwaway credentials from docker-compose.yml, for local use only
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://fleet:fleet_local_only@127.0.0.1:5432/fleet";
const MAX_PAYLOAD_BYTES = 1024;

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

const pool = new pg.Pool({ connectionString: DATABASE_URL });
pool.on("error", (err) => console.error("Database pool error:", err.message));

try {
  await pool.query("SELECT 1");
} catch (err) {
  console.error(`Cannot reach the database at ${DATABASE_URL}: ${errorText(err)}`);
  process.exit(1);
}

const pipeline = new FleetPipeline(DEMO_GEOFENCES);

const stats = {
  received: 0,
  invalid: 0,
  mismatched: 0,
  late: 0,
  restarts: 0,
  saved: 0,
  trips: 0,
  stops: 0,
  events: 0,
  failedWrites: 0,
};

const toTime = "to_timestamp($X::double precision / 1000.0)";
const at = (n: number) => toTime.replace("$X", `$${n}`);

const UPSERT_VEHICLE = `
  INSERT INTO vehicles (vehicle_id, last_seen, lat, lon, speed_kmh, status)
  VALUES ($1, ${at(2)}, $3, $4, $5, $6)
  ON CONFLICT (vehicle_id) DO UPDATE SET
    last_seen = EXCLUDED.last_seen, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
    speed_kmh = EXCLUDED.speed_kmh, status = EXCLUDED.status`;

const INSERT_TRIP = `
  INSERT INTO trips (vehicle_id, started_at, ended_at, start_lat, start_lon, end_lat, end_lon, distance_m)
  VALUES ($1, ${at(2)}, ${at(3)}, $4, $5, $6, $7, $8)`;

const INSERT_STOP = `
  INSERT INTO stops (vehicle_id, started_at, ended_at, lat, lon)
  VALUES ($1, ${at(2)}, ${at(3)}, $4, $5)`;

const INSERT_EVENT = `
  INSERT INTO geofence_events (vehicle_id, geofence_id, event_type, occurred_at, lat, lon)
  VALUES ($1, $2, $3, ${at(4)}, $5, $6)`;

/** Writes one message's results in a single transaction. */
async function save(
  position: Position,
  status: string,
  segments: Segment[],
  events: GeofenceEvent[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(UPSERT_VEHICLE, [
      position.vehicleId,
      position.timestamp,
      position.lat,
      position.lon,
      position.speedKmh ?? null,
      status,
    ]);
    for (const s of segments) {
      if (s.kind === "trip") {
        await client.query(INSERT_TRIP, [
          s.vehicleId, s.startTime, s.endTime,
          s.start.lat, s.start.lon, s.end.lat, s.end.lon, s.distanceM,
        ]);
      } else {
        await client.query(INSERT_STOP, [
          s.vehicleId, s.startTime, s.endTime, s.position.lat, s.position.lon,
        ]);
      }
    }
    for (const e of events) {
      await client.query(INSERT_EVENT, [
        e.vehicleId, e.geofenceId, e.type, e.timestamp, e.position.lat, e.position.lon,
      ]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Writes run one after another so they finish in message order
let queue: Promise<void> = Promise.resolve();

const client = connect(BROKER_URL);

client.on("connect", () => {
  console.log(`Connected to ${BROKER_URL}`);
  client.subscribe(POSITION_TOPIC_FILTER, { qos: 0 }, (err) => {
    if (err) console.error("Subscribe failed:", err.message);
    else console.log(`Subscribed to ${POSITION_TOPIC_FILTER}`);
  });
});

client.on("message", (topic, payload) => {
  stats.received += 1;

  const topicId = vehicleIdFromTopic(topic);
  if (topicId === null || payload.length > MAX_PAYLOAD_BYTES) {
    stats.invalid += 1;
    return;
  }
  const position = parsePosition(payload.toString("utf8"));
  if (position === null) {
    stats.invalid += 1;
    return;
  }
  if (position.vehicleId !== topicId) {
    stats.mismatched += 1;
    return;
  }

  const result = pipeline.process(position);
  if (!result.admitted) {
    stats.late += 1;
    return;
  }
  if (result.restarted) {
    stats.restarts += 1;
    console.log(`Stream restart detected for ${position.vehicleId}`);
  }

  const status = pipeline.status(position.vehicleId) ?? "moving";
  const { segments, events } = result;
  queue = queue
    .then(() => save(position, status, segments, events))
    .then(() => {
      stats.saved += 1;
      stats.trips += segments.filter((s) => s.kind === "trip").length;
      stats.stops += segments.filter((s) => s.kind === "stop").length;
      stats.events += events.length;
    })
    .catch((err) => {
      stats.failedWrites += 1;
      console.error("Write failed, results for this message lost:", errorText(err));
    });
});

client.on("error", (err) => console.error("MQTT error:", err.message));
client.on("close", () => console.log("Connection closed"));

const statsTimer = setInterval(() => console.log(JSON.stringify(stats)), 10_000);

const shutdown = async () => {
  console.log("\nStopping");
  clearInterval(statsTimer);
  await new Promise<void>((resolve) => client.end(false, () => resolve()));
  await queue;
  await pool.end();
  console.log(JSON.stringify(stats));
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);    