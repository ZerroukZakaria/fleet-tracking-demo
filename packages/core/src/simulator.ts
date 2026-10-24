import { distanceMeters } from "./geo";
import { mulberry32 } from "./rng";
import type { LatLon, Position } from "./types";

const METERS_PER_DEGREE = 111_195;

export interface RouteStop {
  point: LatLon;
  /** How long the vehicle waits here, in milliseconds. */
  dwellMs: number;
}

export interface VehiclePlan {
  id: string;
  speedKmh: number;
  /** Visited in order, looping forever. */
  stops: RouteStop[];
}

export interface SimulatorOptions {
  /** Simulated clock start, ms since epoch. Default 0. */
  startTime?: number;
  /** Maximum GPS error per axis, in meters. Default 0 (no noise). */
  noiseM?: number;
  /** Seed for the noise generator. Default 1. */
  seed?: number;
}

interface VehicleState {
  plan: VehiclePlan;
  /** True position, without noise. */
  pos: LatLon;
  /** Index of the stop being driven to. */
  target: number;
  dwellLeftMs: number;
}

const lerp = (a: LatLon, b: LatLon, f: number): LatLon => ({
  lat: a.lat + (b.lat - a.lat) * f,
  lon: a.lon + (b.lon - a.lon) * f,
});

function validate(plans: VehiclePlan[]): void {
  const ids = new Set<string>();
  for (const plan of plans) {
    if (ids.has(plan.id)) throw new Error(`Duplicate vehicle id: ${plan.id}`);
    ids.add(plan.id);
    if (!(plan.speedKmh > 0)) throw new Error(`${plan.id}: speed must be positive`);
    if (plan.stops.length < 2) throw new Error(`${plan.id}: needs at least 2 stops`);
    plan.stops.forEach((stop, i) => {
      const next = plan.stops[(i + 1) % plan.stops.length];
      if (stop.dwellMs < 0) throw new Error(`${plan.id}: negative dwell time`);
      if (distanceMeters(stop.point, next.point) === 0) {
        throw new Error(`${plan.id}: consecutive stops must differ`);
      }
    });
  }
}

/**
 * Moves vehicles along looping stop-to-stop routes on a simulated clock.
 * Vehicles drive straight lines at constant speed (not along real roads).
 */
export class Simulator {
  private now: number;
  private readonly noiseM: number;
  private readonly rng: () => number;
  private readonly vehicles: VehicleState[];

  constructor(plans: VehiclePlan[], options: SimulatorOptions = {}) {
    validate(plans);
    this.now = options.startTime ?? 0;
    this.noiseM = options.noiseM ?? 0;
    this.rng = mulberry32(options.seed ?? 1);
    this.vehicles = plans.map((plan) => ({
      plan,
      pos: plan.stops[0].point,
      target: 1,
      dwellLeftMs: plan.stops[0].dwellMs,
    }));
  }

  /** Current simulated time, ms since epoch. */
  get time(): number {
    return this.now;
  }

  /** Advance the clock by dtMs and report every vehicle's position. */
  tick(dtMs: number): Position[] {
    if (!(dtMs >= 0)) throw new Error("dtMs must be zero or positive");
    this.now += dtMs;
    return this.vehicles.map((v) => {
      this.advance(v, dtMs);
      const p = this.jitter(v.pos);
      return {
        vehicleId: v.plan.id,
        timestamp: this.now,
        lat: p.lat,
        lon: p.lon,
        // Reported speed is 0 while dwelling at a stop
        speedKmh: v.dwellLeftMs > 0 ? 0 : v.plan.speedKmh,
      };
    });
  }

  private advance(v: VehicleState, dtMs: number): void {
    const speedMs = v.plan.speedKmh / 3.6;
    let left = dtMs;

    while (left > 0) {
      if (v.dwellLeftMs > 0) {
        const used = Math.min(left, v.dwellLeftMs);
        v.dwellLeftMs -= used;
        left -= used;
        continue;
      }

      const stop = v.plan.stops[v.target];
      const dist = distanceMeters(v.pos, stop.point);
      const reachable = (speedMs * left) / 1000;

      if (reachable < dist) {
        v.pos = lerp(v.pos, stop.point, reachable / dist);
        left = 0;
      } else {
        // Arrive, spend the travel time, and start dwelling with what is left
        v.pos = stop.point;
        left -= (dist / speedMs) * 1000;
        v.dwellLeftMs = stop.dwellMs;
        v.target = (v.target + 1) % v.plan.stops.length;
      }
    }
  }

  private jitter(p: LatLon): LatLon {
    if (this.noiseM === 0) return p;
    const north = (this.rng() * 2 - 1) * this.noiseM;
    const east = (this.rng() * 2 - 1) * this.noiseM;
    return {
      lat: p.lat + north / METERS_PER_DEGREE,
      lon: p.lon + east / (METERS_PER_DEGREE * Math.cos((p.lat * Math.PI) / 180)),
    };
  }
}