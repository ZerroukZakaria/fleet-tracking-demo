import { distanceMeters } from "./geo";
import type { LatLon, Position, Segment, Stop, Trip } from "./types";

export interface TripDetectorOptions {
  /** A vehicle within this distance of one spot counts as stationary. */
  stopRadiusM?: number;
  /** How long it must stay there to count as a stop. */
  minStopMs?: number;
  /** Trips shorter than this are discarded (yard shuffles, noise). */
  minTripDistanceM?: number;
}

interface Moving {
  mode: "moving";
  start: Position;
  last: Position;
  distanceM: number;
  /** Where the vehicle might have begun a stop. */
  candidate: Position;
  /** Trip distance up to the candidate, so dwell jitter is not counted. */
  candidateDistanceM: number;
}

interface Stopped {
  mode: "stopped";
  anchor: Position;
  startTime: number;
  lastInside: Position;
}

type VehicleState = Moving | Stopped;

const ll = (p: Position): LatLon => ({ lat: p.lat, lon: p.lon });

/**
 * Turns a stream of positions into completed trips and stops, per vehicle.
 *
 * A stop is confirmed once a vehicle has stayed within `stopRadiusM` of one
 * spot for `minStopMs`. The trip then ends at the moment the vehicle arrived
 * there, so reported times are retroactive.
 *
 * Assumes positions for a vehicle arrive in time order and without long gaps.
 */
export class TripDetector {
  private readonly stopRadiusM: number;
  private readonly minStopMs: number;
  private readonly minTripDistanceM: number;
  private readonly states = new Map<string, VehicleState>();

  constructor(options: TripDetectorOptions = {}) {
    this.stopRadiusM = options.stopRadiusM ?? 50;
    this.minStopMs = options.minStopMs ?? 3 * 60_000;
    this.minTripDistanceM = options.minTripDistanceM ?? 100;
  }

  /** Feed one position; returns any segments that just completed. */
  update(p: Position): Segment[] {
    const state = this.states.get(p.vehicleId);
    if (!state) {
      this.states.set(p.vehicleId, this.startMoving(p, p, 0));
      return [];
    }
    return state.mode === "moving"
      ? this.updateMoving(p, state)
      : this.updateStopped(p, state);
  }

  /** Current status of a vehicle, or undefined if never seen. */
  status(vehicleId: string): "moving" | "stopped" | undefined {
    return this.states.get(vehicleId)?.mode;
  }

  /** Close every open segment (end of data) and reset all state. */
  flush(): Segment[] {
    const out: Segment[] = [];
    for (const [vehicleId, s] of this.states) {
      if (s.mode === "moving") {
        out.push(...this.makeTrip(vehicleId, s.start, s.last, s.distanceM));
      } else {
        out.push(this.makeStop(vehicleId, s));
      }
    }
    this.states.clear();
    return out;
  }

  private startMoving(start: Position, last: Position, distanceM: number): Moving {
    return {
      mode: "moving",
      start,
      last,
      distanceM,
      candidate: last,
      candidateDistanceM: distanceM,
    };
  }

  private updateMoving(p: Position, s: Moving): Segment[] {
    s.distanceM += distanceMeters(p, s.last);
    s.last = p;

    if (distanceMeters(p, s.candidate) > this.stopRadiusM) {
      // Still travelling: this point is the new possible stop location
      s.candidate = p;
      s.candidateDistanceM = s.distanceM;
      return [];
    }

    if (p.timestamp - s.candidate.timestamp < this.minStopMs) return [];

    // Stationary long enough: the trip ended when the vehicle reached candidate
    const out = this.makeTrip(
      p.vehicleId,
      s.start,
      s.candidate,
      s.candidateDistanceM,
    );
    this.states.set(p.vehicleId, {
      mode: "stopped",
      anchor: s.candidate,
      startTime: s.candidate.timestamp,
      lastInside: p,
    });
    return out;
  }

  private updateStopped(p: Position, s: Stopped): Segment[] {
    if (distanceMeters(p, s.anchor) <= this.stopRadiusM) {
      s.lastInside = p;
      return [];
    }
    // Left the stop: it ended when the vehicle was last seen there
    const stop = this.makeStop(p.vehicleId, s);
    this.states.set(
      p.vehicleId,
      this.startMoving(s.lastInside, p, distanceMeters(s.lastInside, p)),
    );
    return [stop];
  }

  private makeTrip(
    vehicleId: string,
    start: Position,
    end: Position,
    distanceM: number,
  ): Trip[] {
    if (distanceM < this.minTripDistanceM) return [];
    return [
      {
        kind: "trip",
        vehicleId,
        startTime: start.timestamp,
        endTime: end.timestamp,
        start: ll(start),
        end: ll(end),
        distanceM,
      },
    ];
  }

  private makeStop(vehicleId: string, s: Stopped): Stop {
    return {
      kind: "stop",
      vehicleId,
      startTime: s.startTime,
      endTime: s.lastInside.timestamp,
      position: ll(s.anchor),
    };
  }
}