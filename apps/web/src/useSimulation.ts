import { useEffect, useRef, useState } from "react";
import { DEMO_PLANS, Simulator, TripDetector, type Position } from "@fleet/core";

export interface VehicleView {
  position: Position;
  status: "moving" | "stopped";
}

interface Engine {
  sim: Simulator;
  detector: TripDetector;
}

/** Real milliseconds between simulation steps. */
const TICK_MS = 100;

function toViews(positions: Position[], detector: TripDetector): VehicleView[] {
  return positions.map((position) => ({
    position,
    status: detector.status(position.vehicleId) ?? "moving",
  }));
}

/**
 * Runs the simulator in the browser. Each step advances simulated time by
 * TICK_MS * speed, so speed 60 means one real second is one simulated minute.
 */
export function useSimulation(speed: number, running: boolean) {
  const engine = useRef<Engine | null>(null);
  if (!engine.current) {
    engine.current = {
      sim: new Simulator(DEMO_PLANS, { noiseM: 4, seed: 1 }),
      detector: new TripDetector(),
    };
  }

  const [state, setState] = useState(() => {
    const e = engine.current!;
    return { vehicles: toViews(e.sim.tick(0), e.detector), elapsedMs: 0 };
  });

  useEffect(() => {
    const e = engine.current;
    if (!running || !e) return;
    const id = setInterval(() => {
      const positions = e.sim.tick(TICK_MS * speed);
      for (const p of positions) e.detector.update(p);
      setState({ vehicles: toViews(positions, e.detector), elapsedMs: e.sim.time });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [speed, running]);

  return state;
}