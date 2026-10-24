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


/** A completed trip: the vehicle moved from `start` to `end`. */
export interface Trip {
  kind: "trip";
  vehicleId: string;
  startTime: number;
  endTime: number;
  start: LatLon;
  end: LatLon;
  /** Distance travelled along the reported positions, in meters. */
  distanceM: number;
}

/** A completed stop: the vehicle stayed at `position`. */
export interface Stop {
  kind: "stop";
  vehicleId: string;
  startTime: number;
  endTime: number;
  position: LatLon;
}

export type Segment = Trip | Stop;