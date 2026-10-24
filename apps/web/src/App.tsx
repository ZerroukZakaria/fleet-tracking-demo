import { useState } from "react";
import { FleetMap } from "./FleetMap";
import { useSimulation } from "./useSimulation";

const SPEEDS = [10, 60, 120];

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function App() {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(60);
  const { vehicles, elapsedMs } = useSimulation(speed, running);

  return (
    <div className="app">
      <header className="bar">
        <h1>Fleet tracking demo</h1>
        <button type="button" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : "Play"}
        </button>
        <label>
          Speed{" "}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <span className="clock">Simulated time {formatElapsed(elapsedMs)}</span>
      </header>
      <div className="main">
        <aside className="side" aria-label="Vehicles">
          <ul>
            {vehicles.map(({ position, status }) => (
              <li key={position.vehicleId}>
                <strong>{position.vehicleId}</strong>
                <br />
                <span className="muted">
                  {status}, {Math.round(position.speedKmh ?? 0)} km/h
                </span>
              </li>
            ))}
          </ul>
        </aside>
        <FleetMap vehicles={vehicles} />
      </div>
    </div>
  );
}