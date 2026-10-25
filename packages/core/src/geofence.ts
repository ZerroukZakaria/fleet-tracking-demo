import { distanceMeters } from "./geo";
import type { Geofence, GeofenceEvent, LatLon, Position } from "./types";

/** True if the point is within the fence radius (boundary counts as inside). */
export function isInside(point: LatLon, fence: Geofence): boolean {
  return distanceMeters(point, fence.center) <= fence.radiusM;
}

/**
 * Remembers where each vehicle is relative to each fence and reports
 * enter/exit events when that changes.
 *
 * Entering needs the vehicle within the radius. Leaving needs it to go
 * `exitBufferM` beyond the radius, so GPS jitter at the boundary does not
 * produce a stream of false events.
 *
 * Assumes positions for a vehicle arrive in time order.
 */
export class GeofenceTracker {
  private readonly fences: Geofence[];
  private readonly exitBufferM: number;
  // key: "vehicleId|fenceId" -> currently inside?
  private readonly state = new Map<string, boolean>();

  constructor(fences: Geofence[], exitBufferM = 20) {
    this.fences = fences;
    this.exitBufferM = exitBufferM;
  }

  update(position: Position): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];

    for (const fence of this.fences) {
      const key = `${position.vehicleId}|${fence.id}`;
      const distance = distanceMeters(position, fence.center);
      const wasInside = this.state.get(key);

      let nowInside: boolean;
      if (wasInside === true) {
        nowInside = distance <= fence.radiusM + this.exitBufferM;
      } else {
        nowInside = distance <= fence.radiusM;
      }
      this.state.set(key, nowInside);

      // First sighting (wasInside undefined) records state without an event
      if (wasInside !== undefined && wasInside !== nowInside) {
        events.push({
          type: nowInside ? "enter" : "exit",
          vehicleId: position.vehicleId,
          geofenceId: fence.id,
          timestamp: position.timestamp,
          position: { lat: position.lat, lon: position.lon },
        });
      }
    }

    return events;
  }

    reset(vehicleId: string): void {
    const prefix = `${vehicleId}|`;
    for (const key of [...this.state.keys()]) {
      if (key.startsWith(prefix)) this.state.delete(key);
    }
  }
}