import { useEffect, useRef, useState } from "react";
import {
  DEMO_GEOFENCES,
  DEMO_PLANS,
  GeofenceTracker,
  Simulator,
  TripDetector,
  type GeofenceEvent,
  type Position,
  type Segment,
} from "@fleet/core";

export interface VehicleView {
  position: Position;
  status: "moving" | "stopped";
}

interface Engine {
  sim: Simulator;
  detector: TripDetector;
  fences: GeofenceTracker;
}

/** Real milliseconds between simulation steps. */
const TICK_MS = 100;
/** Alerts kept in the panel (newest first). */
const MAX_EVENTS = 50;

function toViews(positions: Position[], detector: TripDetector): VehicleView[] {
  return positions.map((position) => ({
    position,
    status: detector.status(position.vehicleId) ?? "moving",
  }));
}

/**
 * Runs the simulator and both detectors in the browser. Each step advances
 * simulated time by TICK_MS * speed, so speed 60 means one real second is one
 * simulated minute.
 */
export function useSimulation(speed: number, running: boolean) {
  const engine = useRef<Engine | null>(null);
  if (!engine.current) {
    engine.current = {
      sim: new Simulator(DEMO_PLANS, { noiseM: 4, seed: 1 }),
      detector: new TripDetector(),
      fences: new GeofenceTracker(DEMO_GEOFENCES),
    };
  }

  const [state, setState] = useState(() => {
    const e = engine.current!;
    return {
      vehicles: toViews(e.sim.tick(0), e.detector),
      elapsedMs: 0,
      events: [] as GeofenceEvent[],
      segments: [] as Segment[],
    };
  });

  useEffect(() => {
    const e = engine.current;
    if (!running || !e) return;
    const id = setInterval(() => {
      const positions = e.sim.tick(TICK_MS * speed);
      const newEvents: GeofenceEvent[] = [];
      const newSegments: Segment[] = [];
      for (const p of positions) {
        newSegments.push(...e.detector.update(p));
        newEvents.push(...e.fences.update(p));
      }
      setState((prev) => ({
        vehicles: toViews(positions, e.detector),
        elapsedMs: e.sim.time,
        events: newEvents.length
          ? [...newEvents.reverse(), ...prev.events].slice(0, MAX_EVENTS)
          : prev.events,
        segments: newSegments.length
          ? [...prev.segments, ...newSegments]
          : prev.segments,
      }));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [speed, running]);

  return state;
}