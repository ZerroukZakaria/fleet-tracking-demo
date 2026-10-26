import type { LatLon } from "./types";

const EARTH_RADIUS_M = 6_371_000;

const toRad = (degrees: number): number => (degrees * Math.PI) / 180;
const toDeg = (radians: number): number => (radians * 180) / Math.PI;


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


/**
 * Initial compass bearing from one point to another, in degrees from north,
 * clockwise: 0 = north, 90 = east, 180 = south, 270 = west.
 */
export function bearingDegrees(from: LatLon, to: LatLon): number {
  const phi1 = toRad(from.lat);
  const phi2 = toRad(to.lat);
  const dLon = toRad(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}