import type { Geofence, LatLon } from "./types";
import type { VehiclePlan } from "./simulator";

// Approximate points chosen for plausibility, not surveyed locations.
export const DEPOT: LatLon = { lat: 33.61, lon: -7.535 };
const CASA_CENTER: LatLon = { lat: 33.5731, lon: -7.5898 };
const CASA_PORT: LatLon = { lat: 33.602, lon: -7.613 };
const HASSAN_II: LatLon = { lat: 33.6085, lon: -7.6325 };
const MOHAMMEDIA: LatLon = { lat: 33.6866, lon: -7.383 };
const AIN_HARROUDA: LatLon = { lat: 33.64, lon: -7.45 };
const BOUSKOURA: LatLon = { lat: 33.45, lon: -7.65 };

const minutes = (n: number) => n * 60_000;

/** Five vehicles that all start at the depot and leave at different times. */
export const DEMO_PLANS: VehiclePlan[] = [
  {
    id: "truck-1",
    speedKmh: 45,
    stops: [
      { point: DEPOT, dwellMs: minutes(5) },
      { point: CASA_CENTER, dwellMs: minutes(6) },
      { point: CASA_PORT, dwellMs: minutes(5) },
    ],
  },
  {
    id: "truck-2",
    speedKmh: 55,
    stops: [
      { point: DEPOT, dwellMs: minutes(8) },
      { point: MOHAMMEDIA, dwellMs: minutes(6) },
      { point: AIN_HARROUDA, dwellMs: minutes(5) },
    ],
  },
  {
    id: "van-3",
    speedKmh: 40,
    stops: [
      { point: DEPOT, dwellMs: minutes(4) },
      { point: HASSAN_II, dwellMs: minutes(5) },
      { point: CASA_CENTER, dwellMs: minutes(4) },
    ],
  },
  {
    id: "van-4",
    speedKmh: 50,
    stops: [
      { point: DEPOT, dwellMs: minutes(10) },
      { point: CASA_PORT, dwellMs: minutes(6) },
    ],
  },
  {
    id: "truck-5",
    speedKmh: 60,
    stops: [
      { point: DEPOT, dwellMs: minutes(6) },
      { point: BOUSKOURA, dwellMs: minutes(7) },
      { point: CASA_CENTER, dwellMs: minutes(5) },
    ],
  },
];

export const DEMO_GEOFENCES: Geofence[] = [
  { id: "depot", name: "Main depot", center: DEPOT, radiusM: 150 },
];