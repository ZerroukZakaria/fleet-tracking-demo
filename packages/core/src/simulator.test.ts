import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { Simulator, type VehiclePlan } from "./simulator";
import { DEMO_PLANS, DEPOT } from "./demo-fleet";
import { distanceMeters } from "./geo";
import { TripDetector } from "./trips";
import { GeofenceTracker } from "./geofence";
import type { GeofenceEvent, Position, Segment, Trip } from "./types";

const BASE = { lat: 33.6, lon: -7.5 };
const north = (m: number) => ({ lat: BASE.lat + m / 111_195, lon: BASE.lon });
const near = (actual: number, expected: number, tol = 1) =>
  expect(Math.abs(actual - expected)).toBeLessThan(tol);

// 36 km/h = 10 m/s. Wait 60 s at A, drive 1000 m (100 s), wait 30 s at B.
const plan: VehiclePlan = {
  id: "v1",
  speedKmh: 36,
  stops: [
    { point: BASE, dwellMs: 60_000 },
    { point: north(1000), dwellMs: 30_000 },
  ],
};

describe("mulberry32", () => {
  it("is reproducible and stays within [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("Simulator", () => {
  it("starts at the first stop, dwelling", () => {
    const [p] = new Simulator([plan]).tick(0);
    near(distanceMeters(p, BASE), 0, 0.01);
    expect(p.speedKmh).toBe(0);
  });

  it("waits out the dwell time, then drives at plan speed", () => {
    // 60 s dwell, then 50 s of driving at 10 m/s = 500 m
    const [p] = new Simulator([plan]).tick(110_000);
    near(distanceMeters(p, BASE), 500);
    expect(p.speedKmh).toBe(36);
  });

  it("arrives at the next stop and dwells there", () => {
    // Arrives at 160 s, then 10 s into a 30 s dwell
    const [p] = new Simulator([plan]).tick(170_000);
    near(distanceMeters(p, north(1000)), 0);
    expect(p.speedKmh).toBe(0);
  });

  it("loops back to the first stop", () => {
    // 60 + 100 + 30 + 100 = 290 s to be back at A
    const [p] = new Simulator([plan]).tick(300_000);
    near(distanceMeters(p, BASE), 0);
    expect(p.speedKmh).toBe(0);
  });

  it("advances timestamps from the start time", () => {
    const sim = new Simulator([plan], { startTime: 1_000 });
    expect(sim.tick(5_000)[0].timestamp).toBe(6_000);
    expect(sim.tick(5_000)[0].timestamp).toBe(11_000);
    expect(sim.time).toBe(11_000);
  });

  it("gives the same output for the same seed and different output otherwise", () => {
    const run = (seed: number) => {
      const sim = new Simulator([plan], { noiseM: 5, seed });
      const out: Position[] = [];
      for (let i = 0; i < 20; i++) out.push(...sim.tick(10_000));
      return out;
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it("keeps noise within the configured bound", () => {
    const clean = new Simulator([plan]);
    const noisy = new Simulator([plan], { noiseM: 4, seed: 7 });
    for (let i = 0; i < 50; i++) {
      const [c] = clean.tick(10_000);
      const [n] = noisy.tick(10_000);
      // Worst case is 4 m on both axes: 4 * sqrt(2), about 5.66 m
      expect(distanceMeters(c, n)).toBeLessThan(6);
    }
  });

  it("rejects invalid plans", () => {
    expect(() => new Simulator([{ ...plan, speedKmh: 0 }])).toThrow();
    expect(() => new Simulator([{ ...plan, stops: [plan.stops[0]] }])).toThrow();
    expect(
      () => new Simulator([{ ...plan, stops: [plan.stops[0], plan.stops[0]] }]),
    ).toThrow();
    expect(() => new Simulator([plan, plan])).toThrow();
  });

  it("runs the demo fleet, and every vehicle has left the depot after 11 minutes", () => {
    const sim = new Simulator(DEMO_PLANS);
    let last: Position[] = [];
    for (let i = 0; i < 66; i++) last = sim.tick(10_000);
    expect(last.map((p) => p.vehicleId)).toEqual(DEMO_PLANS.map((p) => p.id));
    for (const p of last) {
      expect(distanceMeters(p, DEPOT)).toBeGreaterThan(150);
    }
  });
});

describe("Simulator with the detection logic", () => {
  it("produces the stops, trips and geofence events worked out by hand", () => {
    // Dwell 600 s at A, drive 3000 m (300 s), dwell 600 s at B, drive back.
    // Timeline: leave A at 600 s, reach B at 900 s, leave B at 1500 s,
    // back at A at 1800 s. Ticks every 10 s, run for 2400 s.
    const A = BASE;
    const B = north(3000);
    const sim = new Simulator([
      {
        id: "v1",
        speedKmh: 36,
        stops: [
          { point: A, dwellMs: 600_000 },
          { point: B, dwellMs: 600_000 },
        ],
      },
    ]);
    const trips = new TripDetector();
    const fences = new GeofenceTracker([
      { id: "depot", name: "Depot", center: A, radiusM: 150 },
    ]);

    const segments: Segment[] = [];
    const events: GeofenceEvent[] = [];
    for (let i = 0; i < 240; i++) {
      for (const p of sim.tick(10_000)) {
        segments.push(...trips.update(p));
        events.push(...fences.update(p));
      }
    }
    segments.push(...trips.flush());

    expect(segments.map((s) => s.kind)).toEqual([
      "stop",
      "trip",
      "stop",
      "trip",
      "stop",
    ]);
    expect(segments.map((s) => [s.startTime, s.endTime])).toEqual([
      [10_000, 600_000],
      [600_000, 900_000],
      [900_000, 1_500_000],
      [1_500_000, 1_800_000],
      [1_800_000, 2_400_000],
    ]);
    near((segments[1] as Trip).distanceM, 3000, 5);
    near((segments[3] as Trip).distanceM, 3000, 5);

    // Exit once the vehicle is past 150 + 20 m (first tick beyond: 200 m),
    // re-enter when it is back within 150 m (100 m from A)
    expect(events.map((e) => `${e.type}@${e.timestamp}`)).toEqual([
      "exit@620000",
      "enter@1790000",
    ]);
  });
});