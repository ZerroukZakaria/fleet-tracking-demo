import { describe, it, expect } from "vitest";
import { TripDetector } from "./trips";
import type { Position, Segment, Stop, Trip } from "./types";

const BASE = { lat: 33.6, lon: -7.5 };

/** A position `northM` meters north of BASE, `tSec` seconds after time zero. */
const pos = (vehicleId: string, tSec: number, northM: number): Position => ({
  vehicleId,
  timestamp: tSec * 1000,
  lat: BASE.lat + northM / 111_195,
  lon: BASE.lon,
});

/** Feed [seconds, metersNorth] points for one vehicle; collect segments. */
function feed(d: TripDetector, id: string, points: [number, number][]): Segment[] {
  const out: Segment[] = [];
  for (const [t, m] of points) out.push(...d.update(pos(id, t, m)));
  return out;
}

const near = (actual: number, expected: number, tol = 5) =>
  expect(Math.abs(actual - expected)).toBeLessThan(tol);

// A vehicle driving 500 m per minute, then parking at 1500 m
const DRIVE: [number, number][] = [
  [0, 0],
  [60, 500],
  [120, 1000],
  [180, 1500],
];

describe("TripDetector", () => {
  it("reports a trip once the vehicle has been stationary long enough", () => {
    const d = new TripDetector();
    const segments = feed(d, "v1", [
      ...DRIVE,
      [240, 1500],
      [300, 1505],
      [360, 1500], // 180 s after arriving: stop confirmed
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      kind: "trip",
      vehicleId: "v1",
      startTime: 0,
      endTime: 180_000, // retroactive: when it arrived, not when detected
    });
    near((segments[0] as Trip).distanceM, 1500);
  });

  it("reports the stop when the vehicle moves off, and starts a new trip", () => {
    const d = new TripDetector();
    const segments = feed(d, "v1", [
      ...DRIVE,
      [240, 1500],
      [300, 1505],
      [360, 1500],
      [420, 1500],
      [480, 2000], // leaves
    ]);
    expect(segments.map((s) => s.kind)).toEqual(["trip", "stop"]);
    expect(segments[1]).toMatchObject({
      kind: "stop",
      startTime: 180_000,
      endTime: 420_000,
    });

    const rest = d.flush();
    expect(rest).toHaveLength(1);
    expect(rest[0]).toMatchObject({
      kind: "trip",
      startTime: 420_000,
      endTime: 480_000,
    });
    near((rest[0] as Trip).distanceM, 500);
  });

  it("does not report a stop for a short pause", () => {
    const d = new TripDetector();
    const segments = feed(d, "v1", [
      [0, 0],
      [60, 500],
      [120, 1000],
      [150, 1000],
      [180, 1000], // only 60 s stationary
      [240, 1500],
    ]);
    expect(segments).toEqual([]);

    const rest = d.flush();
    expect(rest).toHaveLength(1);
    expect(rest[0]).toMatchObject({ kind: "trip", startTime: 0, endTime: 240_000 });
    near((rest[0] as Trip).distanceM, 1500);
  });

  it("ignores GPS jitter while parked", () => {
    const d = new TripDetector();
    const segments = feed(d, "v1", [
      [0, 0],
      [60, 8],
      [120, -6],
      [180, 10],
      [240, -4],
      [300, 5],
    ]);
    expect(segments).toEqual([]); // no trips, no spurious segments

    const rest = d.flush();
    expect(rest).toHaveLength(1);
    expect(rest[0]).toMatchObject({ kind: "stop", startTime: 0, endTime: 300_000 });
  });

  it("drops tiny movements instead of reporting them as trips", () => {
    const d = new TripDetector();
    const segments = feed(d, "v1", [
      [0, 0],
      [60, 0],
      [120, 0],
      [180, 0], // stop confirmed
      [240, 80], // shuffles 80 m
      [300, 80],
      [360, 80],
      [420, 80], // second stop confirmed
    ]);
    const rest = d.flush();
    const all = [...segments, ...rest];
    expect(all.map((s) => s.kind)).toEqual(["stop", "stop"]);
    expect((all[0] as Stop).endTime).toBe(180_000);
    expect((all[1] as Stop).startTime).toBe(240_000);
  });

  it("tracks vehicles independently", () => {
    const d = new TripDetector();
    d.update(pos("v1", 0, 0));
    d.update(pos("v2", 0, 0));
    expect(d.update(pos("v1", 180, 0))).toEqual([]); // v1 parked
    expect(d.update(pos("v2", 180, 1500))).toEqual([]); // v2 drove off
    const rest = d.flush();
    expect(rest.map((s) => `${s.vehicleId}:${s.kind}`)).toEqual([
      "v1:stop",
      "v2:trip",
    ]);
  });

  it("reports vehicle status", () => {
    const d = new TripDetector();
    expect(d.status("v1")).toBeUndefined();
    d.update(pos("v1", 0, 0));
    expect(d.status("v1")).toBe("moving");
    feed(d, "v1", [
      [60, 8],
      [120, -6],
      [180, 10],
    ]);
    expect(d.status("v1")).toBe("stopped");
  });
});