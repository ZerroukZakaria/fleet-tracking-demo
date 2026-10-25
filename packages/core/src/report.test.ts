import { describe, it, expect } from "vitest";
import { buildReport } from "./report";
import { Simulator } from "./simulator";
import { TripDetector } from "./trips";
import type { Segment } from "./types";

const BASE = { lat: 33.6, lon: -7.5 };
const north = (m: number) => ({ lat: BASE.lat + m / 111_195, lon: BASE.lon });

const trip = (
  vehicleId: string,
  startTime: number,
  endTime: number,
  distanceM: number,
): Segment => ({
  kind: "trip",
  vehicleId,
  startTime,
  endTime,
  start: BASE,
  end: BASE,
  distanceM,
});

const stop = (vehicleId: string, startTime: number, endTime: number): Segment => ({
  kind: "stop",
  vehicleId,
  startTime,
  endTime,
  position: BASE,
});

describe("buildReport", () => {
  it("gives zero rows for listed vehicles with no segments, in order", () => {
    const report = buildReport([], ["b", "a"]);
    expect(report.map((r) => r.vehicleId)).toEqual(["b", "a"]);
    expect(report.every((r) => r.trips === 0 && r.stops === 0)).toBe(true);
  });

  it("totals trips and stops per vehicle", () => {
    const report = buildReport(
      [
        trip("v1", 0, 600_000, 5000),
        stop("v1", 600_000, 1_000_000),
        trip("v1", 1_000_000, 1_300_000, 2000),
        stop("v2", 0, 100_000),
      ],
      ["v1", "v2"],
    );
    expect(report[0]).toEqual({
      vehicleId: "v1",
      trips: 2,
      distanceM: 7000,
      drivingMs: 900_000,
      stops: 1,
      stoppedMs: 400_000,
    });
    expect(report[1]).toEqual({
      vehicleId: "v2",
      trips: 0,
      distanceM: 0,
      drivingMs: 0,
      stops: 1,
      stoppedMs: 100_000,
    });
  });

  it("lists vehicles that were not pre-registered after the listed ones", () => {
    const report = buildReport([stop("zz", 0, 1000)], ["a", "b"]);
    expect(report.map((r) => r.vehicleId)).toEqual(["a", "b", "zz"]);
  });

  it("matches the hand-worked simulator scenario", () => {
    // Same scenario as the simulator test: dwell 600 s at A, drive 3000 m
    // (300 s), dwell 600 s at B, drive back, run for 2400 s.
    // Trips: 2 x 300 s, 2 x 3000 m. Stops: 590 s + 600 s + 600 s.
    const sim = new Simulator([
      {
        id: "v1",
        speedKmh: 36,
        stops: [
          { point: BASE, dwellMs: 600_000 },
          { point: north(3000), dwellMs: 600_000 },
        ],
      },
    ]);
    const detector = new TripDetector();
    const segments: Segment[] = [];
    for (let i = 0; i < 240; i++) {
      for (const p of sim.tick(10_000)) segments.push(...detector.update(p));
    }
    segments.push(...detector.flush());

    const [row] = buildReport(segments, ["v1"]);
    expect(row.trips).toBe(2);
    expect(Math.abs(row.distanceM - 6000)).toBeLessThan(10);
    expect(row.drivingMs).toBe(600_000);
    expect(row.stops).toBe(3);
    expect(row.stoppedMs).toBe(1_790_000);
  });
});