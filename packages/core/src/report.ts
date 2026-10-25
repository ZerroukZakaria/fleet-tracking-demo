import type { Segment } from "./types";

export interface VehicleReport {
  vehicleId: string;
  trips: number;
  distanceM: number;
  drivingMs: number;
  stops: number;
  stoppedMs: number;
}

/**
 * Totals completed trips and stops per vehicle. Vehicles listed in
 * `vehicleIds` always get a row (zeros if nothing happened yet), in that
 * order, followed by any other vehicles seen in the segments.
 */
export function buildReport(
  segments: Segment[],
  vehicleIds: string[] = [],
): VehicleReport[] {
  const rows = new Map<string, VehicleReport>();
  const row = (id: string): VehicleReport => {
    let r = rows.get(id);
    if (!r) {
      r = { vehicleId: id, trips: 0, distanceM: 0, drivingMs: 0, stops: 0, stoppedMs: 0 };
      rows.set(id, r);
    }
    return r;
  };

  for (const id of vehicleIds) row(id);

  for (const s of segments) {
    const r = row(s.vehicleId);
    const duration = s.endTime - s.startTime;
    if (s.kind === "trip") {
      r.trips += 1;
      r.distanceM += s.distanceM;
      r.drivingMs += duration;
    } else {
      r.stops += 1;
      r.stoppedMs += duration;
    }
  }

  return [...rows.values()];
}