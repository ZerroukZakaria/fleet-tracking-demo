import { describe, it, expect } from "vitest";
import { GeofenceTracker, isInside } from "./geofence";
import type { Geofence, GeofenceEvent, Position } from "./types";

const center = { lat: 33.6, lon: -7.5 };
const depot: Geofence = { id: "depot", name: "Depot", center, radiusM: 100 };

// One degree of latitude is about 111,195 m, so this places a point
// roughly `meters` due north of the center.
const at = (meters: number) => ({
  lat: center.lat + meters / 111_195,
  lon: center.lon,
});

let clock = 0;
const pos = (vehicleId: string, meters: number): Position => ({
  vehicleId,
  timestamp: (clock += 1000),
  ...at(meters),
});

/** Feed a series of distances for one vehicle and collect all events. */
function run(tracker: GeofenceTracker, vehicleId: string, distances: number[]) {
  const events: GeofenceEvent[] = [];
  for (const d of distances) events.push(...tracker.update(pos(vehicleId, d)));
  return events;
}

describe("isInside", () => {
  it("is true just inside the radius", () => {
    expect(isInside(at(99.9), depot)).toBe(true);
  });

  it("is false just outside the radius", () => {
    expect(isInside(at(100.1), depot)).toBe(false);
  });
});

describe("GeofenceTracker", () => {
  it("emits nothing for the first position, even inside a fence", () => {
    const t = new GeofenceTracker([depot]);
    expect(run(t, "v1", [50])).toEqual([]);
  });

  it("emits an enter event when a vehicle moves into the fence", () => {
    const t = new GeofenceTracker([depot]);
    const events = run(t, "v1", [200, 90]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "enter",
      vehicleId: "v1",
      geofenceId: "depot",
    });
  });

  it("does not repeat events while the vehicle stays inside", () => {
    const t = new GeofenceTracker([depot]);
    const events = run(t, "v1", [200, 90, 80, 70, 60]);
    expect(events).toHaveLength(1);
  });

  it("emits an exit event when a vehicle leaves the fence", () => {
    const t = new GeofenceTracker([depot]);
    const events = run(t, "v1", [50, 200]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "exit", geofenceId: "depot" });
  });

  it("uses a buffer so leaving needs to go past the radius", () => {
    const t = new GeofenceTracker([depot], 20);
    // start outside, enter, drift to 110 m (inside the buffer: no exit),
    // go to 130 m (past radius + buffer: exit), return to 110 m (needs
    // <= 100 m to re-enter: no event), then 90 m (enter)
    const events = run(t, "v1", [200, 90, 110, 130, 110, 90]);
    expect(events.map((e) => e.type)).toEqual(["enter", "exit", "enter"]);
  });

  it("ignores jitter around the boundary", () => {
    const t = new GeofenceTracker([depot], 20);
    const events = run(t, "v1", [200, 95, 105, 98, 106, 99, 104]);
    expect(events.map((e) => e.type)).toEqual(["enter"]);
  });

  it("tracks vehicles independently", () => {
    const t = new GeofenceTracker([depot]);
    run(t, "v1", [200]);
    run(t, "v2", [200]);
    expect(run(t, "v1", [50]).map((e) => e.vehicleId)).toEqual(["v1"]);
    expect(run(t, "v2", [300])).toEqual([]);
  });

  it("checks every fence and reports each crossing", () => {
    const yard: Geofence = {
      id: "yard",
      name: "Yard",
      center, // same center, bigger radius
      radiusM: 500,
    };
    const t = new GeofenceTracker([depot, yard]);
    // 1000 m: outside both. 300 m: enters yard only. 50 m: enters depot.
    const events = run(t, "v1", [1000, 300, 50]);
    expect(events.map((e) => `${e.type}:${e.geofenceId}`)).toEqual([
      "enter:yard",
      "enter:depot",
    ]);
  });
});