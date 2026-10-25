import { GeofenceTracker } from "./geofence";
import { StreamGuard } from "./ordering";
import { TripDetector, type TripDetectorOptions } from "./trips";
import type { Geofence, GeofenceEvent, Position, Segment } from "./types";

export interface PipelineOptions {
  restartGapMs?: number;
  exitBufferM?: number;
  trips?: TripDetectorOptions;
}

export interface PipelineResult {
  /** False if the position was dropped as late or duplicate. */
  admitted: boolean;
  /** True if this position was treated as a stream restart. */
  restarted: boolean;
  segments: Segment[];
  events: GeofenceEvent[];
}

/** Ordering guard + trip detection + geofence detection, for one stream. */
export class FleetPipeline {
  private readonly guard: StreamGuard;
  private readonly detector: TripDetector;
  private readonly fences: GeofenceTracker;

  constructor(fences: Geofence[], options: PipelineOptions = {}) {
    this.guard = new StreamGuard(options.restartGapMs);
    this.detector = new TripDetector(options.trips);
    this.fences = new GeofenceTracker(fences, options.exitBufferM);
  }

  process(p: Position): PipelineResult {
    const admission = this.guard.admit(p);
    if (admission === "late") {
      return { admitted: false, restarted: false, segments: [], events: [] };
    }

    const segments: Segment[] = [];
    const restarted = admission === "restart";
    if (restarted) {
      // Save what the vehicle was doing, then start it from scratch
      segments.push(...this.detector.flushVehicle(p.vehicleId));
      this.fences.reset(p.vehicleId);
    }
    segments.push(...this.detector.update(p));
    const events = this.fences.update(p);
    return { admitted: true, restarted, segments, events };
  }

  status(vehicleId: string): "moving" | "stopped" | undefined {
    return this.detector.status(vehicleId);
  }

  /** Close every open segment (end of data). */
  flush(): Segment[] {
    return this.detector.flush();
  }
}