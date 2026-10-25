import { describe, it, expect } from "vitest";
import {
  encodePosition,
  parsePosition,
  positionTopic,
  vehicleIdFromTopic,
} from "./messages";
import type { Position } from "./types";

const valid: Position = {
  vehicleId: "truck-1",
  timestamp: 1_700_000_000_000,
  lat: 33.6,
  lon: -7.5,
  speedKmh: 45,
};

describe("topics", () => {
  it("builds the position topic for a vehicle", () => {
    expect(positionTopic("truck-1")).toBe("fleet/vehicles/truck-1/position");
  });

  it("rejects ids that would break the topic", () => {
    for (const id of ["", "a/b", "a+b", "a#", "a b", "x".repeat(65)]) {
      expect(() => positionTopic(id)).toThrow();
    }
  });

  it("extracts the vehicle id from a position topic", () => {
    expect(vehicleIdFromTopic("fleet/vehicles/van-3/position")).toBe("van-3");
  });

  it("returns null for topics that are not position topics", () => {
    const topics = [
      "fleet/test",
      "fleet/vehicles/position",
      "fleet/vehicles//position",
      "fleet/vehicles/a/b/position",
      "fleet/vehicles/a/position/extra",
    ];
    for (const t of topics) expect(vehicleIdFromTopic(t)).toBeNull();
  });
});

describe("position messages", () => {
  it("survives a round trip", () => {
    expect(parsePosition(encodePosition(valid))).toEqual(valid);
  });

  it("rejects text that is not a JSON object", () => {
    for (const text of ["not json", "42", "null", "[]", '"text"']) {
      expect(parsePosition(text)).toBeNull();
    }
  });

  it("rejects wrong types, missing fields and out-of-range values", () => {
    const bad = [
      { ...valid, vehicleId: 7 },
      { ...valid, vehicleId: "a/b" },
      { ...valid, timestamp: "now" },
      { ...valid, timestamp: -1 },
      { ...valid, lat: 91 },
      { ...valid, lon: -181 },
      { ...valid, speedKmh: -5 },
      { ...valid, lat: undefined }, // dropped by JSON.stringify: field missing
    ];
    for (const b of bad) expect(parsePosition(JSON.stringify(b))).toBeNull();
  });

  it("rejects NaN, which JSON turns into null", () => {
    expect(parsePosition(encodePosition({ ...valid, lat: NaN }))).toBeNull();
  });

  it("leaves speedKmh out when the message has none", () => {
    const p: Position = { vehicleId: "v1", timestamp: 1, lat: 0, lon: 0 };
    const parsed = parsePosition(encodePosition(p));
    expect(parsed).toEqual(p);
    expect(parsed !== null && "speedKmh" in parsed).toBe(false);
  });
});