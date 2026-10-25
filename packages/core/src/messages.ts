import type { Position } from "./types";

/** Subscribe to this to receive every vehicle's positions (+ matches one level). */
export const POSITION_TOPIC_FILTER = "fleet/vehicles/+/position";

// Ids end up inside topic paths, so they must not contain / + # or spaces
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const isFiniteNumber = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);

export function positionTopic(vehicleId: string): string {
  if (!ID_PATTERN.test(vehicleId)) {
    throw new Error(`Invalid vehicle id: "${vehicleId}"`);
  }
  return `fleet/vehicles/${vehicleId}/position`;
}

/** The vehicle id in a position topic, or null if it is not one. */
export function vehicleIdFromTopic(topic: string): string | null {
  const match = /^fleet\/vehicles\/([A-Za-z0-9_-]{1,64})\/position$/.exec(topic);
  return match ? match[1] : null;
}

export function encodePosition(position: Position): string {
  return JSON.stringify(position);
}

/**
 * Parses and validates a position message. Returns null for anything that is
 * not a well-formed position, so callers can drop bad messages safely.
 */
export function parsePosition(payload: string): Position | null {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;

  const { vehicleId, timestamp, lat, lon, speedKmh } = data as Record<string, unknown>;
  if (typeof vehicleId !== "string" || !ID_PATTERN.test(vehicleId)) return null;
  if (!isFiniteNumber(timestamp) || timestamp < 0) return null;
  if (!isFiniteNumber(lat) || lat < -90 || lat > 90) return null;
  if (!isFiniteNumber(lon) || lon < -180 || lon > 180) return null;
  if (speedKmh !== undefined && (!isFiniteNumber(speedKmh) || speedKmh < 0)) {
    return null;
  }

  const position: Position = { vehicleId, timestamp, lat, lon };
  if (speedKmh !== undefined) position.speedKmh = speedKmh;
  return position;
}