import { describe, it, expect } from "vitest";
import { distanceMeters, bearingDegrees } from "./geo";

describe("distanceMeters", () => {
  it("is zero for identical points", () => {
    const p = { lat: 33.5731, lon: -7.5898 };
    expect(distanceMeters(p, p)).toBe(0);
  });

  it("is about 111.2 km for one degree of latitude", () => {
    const d = distanceMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeCloseTo(111_195, 0);
  });

  it("is about 111.2 km for one degree of longitude at the equator", () => {
    const d = distanceMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    expect(d).toBeCloseTo(111_195, 0);
  });

  it("shrinks longitude distances at higher latitudes", () => {
    // At 60° latitude, one degree of longitude is about half as long
    const d = distanceMeters({ lat: 60, lon: 0 }, { lat: 60, lon: 1 });
    expect(Math.abs(d - 55_597)).toBeLessThan(50);
  });

  it("gives the same result in both directions", () => {
    const a = { lat: 33.5731, lon: -7.5898 };
    const b = { lat: 33.6866, lon: -7.383 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  it("puts Casablanca and Mohammedia roughly 20 to 26 km apart", () => {
    const casablanca = { lat: 33.5731, lon: -7.5898 };
    const mohammedia = { lat: 33.6866, lon: -7.383 };
    const d = distanceMeters(casablanca, mohammedia);
    expect(d).toBeGreaterThan(20_000);
    expect(d).toBeLessThan(26_000);
  });



describe("bearingDegrees", () => {
  const origin = { lat: 0, lon: 0 };

  it("points to the four compass directions", () => {
    expect(bearingDegrees(origin, { lat: 1, lon: 0 })).toBeCloseTo(0, 6);
    expect(bearingDegrees(origin, { lat: 0, lon: 1 })).toBeCloseTo(90, 6);
    expect(bearingDegrees(origin, { lat: -1, lon: 0 })).toBeCloseTo(180, 6);
    expect(bearingDegrees(origin, { lat: 0, lon: -1 })).toBeCloseTo(270, 6);
  });

  it("always returns a value from 0 up to (not including) 360", () => {
    for (let angle = 0; angle < 360; angle += 15) {
      const rad = (angle * Math.PI) / 180;
      const b = bearingDegrees(origin, {
        lat: Math.cos(rad) * 0.1,
        lon: Math.sin(rad) * 0.1,
      });
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});




});