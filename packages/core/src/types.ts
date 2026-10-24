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