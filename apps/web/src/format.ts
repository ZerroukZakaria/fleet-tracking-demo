import { DEMO_GEOFENCES } from "@fleet/core";

const pad = (n: number) => String(n).padStart(2, "0");

/** Simulated elapsed time as HH:MM:SS. */
export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map(pad)
    .join(":");
}

/** A duration as "42 min" or "1 h 05 min". */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${pad(m)} min` : `${m} min`;
}

export const formatKm = (meters: number): string => `${(meters / 1000).toFixed(1)} km`;

export const formatCoord = (degrees: number): string => degrees.toFixed(4);

/** The demo fleet has no vehicle type field, so it comes from the id. */
export const vehicleType = (id: string): string => (id.startsWith("van") ? "Van" : "Truck");

export const fenceName = (id: string): string =>
  DEMO_GEOFENCES.find((g) => g.id === id)?.name ?? id;