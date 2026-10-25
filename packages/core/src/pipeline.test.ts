import { describe, it, expect } from "vitest";
import { FleetPipeline } from "./pipeline";
import { Simulator } from "./simulator";
import type { GeofenceEvent, Position, Segment, Trip } from "./types";

const BASE = { lat: 33.6, lon: -7.5 };
const north = (m: number) => ({ lat: BASE.lat + m / 111_195, lon: BASE.lon });
const T0 = 10_000_000_000; // an arbitrary start time in ms
const pos = (vehicleId: string, timestamp: number, m: number): Position => ({
  vehicleId,
  timestamp,
  ...north(m),
});
const depot = { id: "depot", name: "Depot", center: BASE, radiusM: 100 };

describe("FleetPipeline", () => {
  it("gives the same results as the detectors on the hand-worked scenario", () => {
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
    const pipeline = new FleetPipeline([
      { id: "depot", name: "Depot", center: BASE, radiusM: 150 },
    ]);

    const segments: Segment[] = [];
    const events: GeofenceEvent[] = [];
    for (let i = 0; i < 240; i++) {
      for (const p of sim.tick(10_000)) {
        const r = pipeline.process(p);
        expect(r.admitted).toBe(true);
        expect(r.restarted).toBe(false);
        segments.push(...r.segments);
        events.push(...r.events);
      }
    }
    segments.push(...pipeline.flush());

    expect(segments.map((s) => [s.kind, s.startTime, s.endTime])).toEqual([
      ["stop", 10_000, 600_000],
      ["trip", 600_000, 900_000],
      ["stop", 900_000, 1_500_000],
      ["trip", 1_500_000, 1_800_000],
      ["stop", 1_800_000, 2_400_000],
    ]);
    expect(events.map((e) => `${e.type}@${e.timestamp}`)).toEqual([
      "exit@620000",
      "enter@1790000",
    ]);
  });

  it("drops duplicate and late positions and ignores their content", () => {
    const pipeline = new FleetPipeline([depot]);
    expect(pipeline.process(pos("v1", T0, 0)).admitted).toBe(true);
    expect(pipeline.process(pos("v1", T0 + 60_000, 1000)).admitted).toBe(true);
    // Same timestamp, then an older one: both dropped
    expect(pipeline.process(pos("v1", T0 + 60_000, 5000)).admitted).toBe(false);
    expect(pipeline.process(pos("v1", T0 + 30_000, 5000)).admitted).toBe(false);
    expect(pipeline.process(pos("v1", T0 + 120_000, 2000)).admitted).toBe(true);

    // The 5000 m positions must not have affected the trip
    const [trip] = pipeline.flush();
    expect(trip).toMatchObject({ kind: "trip", endTime: T0 + 120_000 });
    expect(Math.abs((trip as Trip).distanceM - 2000)).toBeLessThan(5);
  });

  it("closes the open trip on a stream restart and resets zone state", () => {
    const pipeline = new FleetPipeline([depot]);
    pipeline.process(pos("v1", T0, 0)); // inside the depot (first sighting)
    pipeline.process(pos("v1", T0 + 60_000, 1000));
    pipeline.process(pos("v1", T0 + 120_000, 2000)); // outside

    // Timestamps jump back by 4120 s, which is more than an hour
    const result = pipeline.process(pos("v1", T0 - 4_000_000, 0));

    expect(result.admitted).toBe(true);
    expect(result.restarted).toBe(true);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({
      kind: "trip",
      vehicleId: "v1",
      startTime: T0,
      endTime: T0 + 120_000,
    });
    expect(Math.abs((result.segments[0] as Trip).distanceM - 2000)).toBeLessThan(5);
    // Back inside the depot, but the zone state was reset: no "enter" event
    expect(result.events).toEqual([]);
    expect(pipeline.status("v1")).toBe("moving");
  });
});