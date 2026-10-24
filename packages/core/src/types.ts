/** A point on the Earth, in decimal degrees. */
export interface LatLon {
  lat: number;
  lon: number;
}

/** One position report from a vehicle. */
export interface Position extends LatLon {
  vehicleId: string;
  /** Milliseconds since the Unix epoch (what Date.now() returns). */
  timestamp: number;
  /** Optional speed reported by the device, in km/h. */
  speedKmh?: number;
}

/** A circular zone. */
export interface Geofence {
  id: string;
  name: string;
  center: LatLon;
  radiusM: number;
}

/** Emitted when a vehicle crosses a geofence boundary. */
export interface GeofenceEvent {
  type: "enter" | "exit";
  vehicleId: string;
  geofenceId: string;
  timestamp: number;
  position: LatLon;
}