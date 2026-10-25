import type { Position } from "./types";

export type Admission = "accept" | "late" | "restart";

/**
 * Decides whether a position can be processed, per vehicle.
 *
 * - newer than the last one: accept
 * - same time or older, within the restart gap: late (drop it)
 * - older by more than the restart gap: the stream restarted, so accept it
 *   and use it as the new baseline
 */
export class StreamGuard {
  private readonly restartGapMs: number;
  private readonly lastSeen = new Map<string, number>();

  constructor(restartGapMs = 3_600_000) {
    this.restartGapMs = restartGapMs;
  }

  admit(p: Position): Admission {
    const last = this.lastSeen.get(p.vehicleId);
    if (last === undefined || p.timestamp > last) {
      this.lastSeen.set(p.vehicleId, p.timestamp);
      return "accept";
    }
    if (last - p.timestamp > this.restartGapMs) {
      this.lastSeen.set(p.vehicleId, p.timestamp);
      return "restart";
    }
    return "late";
  }
}