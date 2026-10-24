import type { LatLon } from "@fleet/core";

const METERS_PER_DEGREE = 111_195;

/** A GeoJSON polygon approximating a circle (good enough at city scale). */
export function circlePolygon(center: LatLon, radiusM: number, steps = 64) {
  const ring: [number, number][] = [];
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([
      center.lon + (radiusM * Math.sin(angle)) / (METERS_PER_DEGREE * cosLat),
      center.lat + (radiusM * Math.cos(angle)) / METERS_PER_DEGREE,
    ]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [ring] },
  };
}   