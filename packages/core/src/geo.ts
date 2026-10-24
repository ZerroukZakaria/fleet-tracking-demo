import type { LatLon } from "./types";

const EARTH_RADIUS_M = 6_371_000;

const toRad = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Straight-line distance between two points, in meters (haversine formula).
 * Treats the Earth as a sphere, which is accurate enough for fleet tracking.
 */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  // min() guards against floating-point values slightly above 1
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}