import { describe, it, expect } from "vitest";
import { TripDetector } from "./trips";
import type { Position, Trip } from "./types";

const BASE = { lat: 33.6, lon: -7.5 };
const pos = (vehicleId: string, tSec: number, northM: number): Position => ({
  vehicleId,
  timestamp: tSec * 1000,
  lat: BASE.lat + northM / 111_195,
  lon: BASE.lon,
});

describe("TripDetector.flushVehicle", () => {
  it("closes only that vehicle's open segment and resets it", () => {
    const d = new TripDetector();
    d.update(pos("v1", 0, 0));
    d.update(pos("v2", 0, 0));
    d.update(pos("v1", 60, 1000));
    d.update(pos("v1", 120, 2000));

    const out = d.flushVehicle("v1");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: "trip",
      vehicleId: "v1",
      startTime: 0,
      endTime: 120_000,
    });
    expect(Math.abs((out[0] as Trip).distanceM - 2000)).toBeLessThan(5);

    expect(d.status("v1")).toBeUndefined();
    expect(d.status("v2")).toBe("moving");
    expect(d.flushVehicle("nobody")).toEqual([]);
  });
});