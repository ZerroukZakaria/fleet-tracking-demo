import { describe, it, expect } from "vitest";
import { StreamGuard } from "./ordering";
import type { Position } from "./types";

const HOUR = 3_600_000;
const p = (vehicleId: string, timestamp: number): Position => ({
  vehicleId,
  timestamp,
  lat: 0,
  lon: 0,
});

describe("StreamGuard", () => {
  it("accepts the first position of a vehicle", () => {
    expect(new StreamGuard().admit(p("v1", 1000))).toBe("accept");
  });

  it("accepts increasing timestamps", () => {
    const g = new StreamGuard();
    expect(g.admit(p("v1", 1000))).toBe("accept");
    expect(g.admit(p("v1", 2000))).toBe("accept");
  });

  it("treats an equal timestamp as late", () => {
    const g = new StreamGuard();
    g.admit(p("v1", 1000));
    expect(g.admit(p("v1", 1000))).toBe("late");
  });

  it("drops an older position without moving the baseline", () => {
    const g = new StreamGuard();
    g.admit(p("v1", 10_000));
    expect(g.admit(p("v1", 5_000))).toBe("late");
    expect(g.admit(p("v1", 10_001))).toBe("accept");
  });

  it("detects a restart when a position is older by more than the gap", () => {
    const g = new StreamGuard();
    g.admit(p("v1", 10 * HOUR));
    const restartTime = 10 * HOUR - HOUR - 1;
    expect(g.admit(p("v1", restartTime))).toBe("restart");
    // The new baseline is the restart position
    expect(g.admit(p("v1", restartTime + 1000))).toBe("accept");
  });

  it("treats exactly the gap as late, not a restart", () => {
    const g = new StreamGuard();
    g.admit(p("v1", 10 * HOUR));
    expect(g.admit(p("v1", 9 * HOUR))).toBe("late");
  });

  it("tracks vehicles independently", () => {
    const g = new StreamGuard();
    g.admit(p("v1", 10 * HOUR));
    expect(g.admit(p("v2", 1000))).toBe("accept");
  });
});