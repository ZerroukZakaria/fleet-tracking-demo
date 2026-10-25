import { useMemo, useState } from "react";
import { DEMO_GEOFENCES, DEMO_PLANS, buildReport } from "@fleet/core";
import { FleetMap } from "./FleetMap";
import { useSimulation } from "./useSimulation";
import { formatDuration, formatElapsed } from "./format";

const SPEEDS = [10, 60, 120];
const VEHICLE_IDS = DEMO_PLANS.map((p) => p.id);
const fenceName = (id: string) =>
  DEMO_GEOFENCES.find((g) => g.id === id)?.name ?? id;

export default function App() {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(60);
  const { vehicles, elapsedMs, events, segments } = useSimulation(speed, running);
  const report = useMemo(() => buildReport(segments, VEHICLE_IDS), [segments]);

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
        <aside className="side" aria-label="Vehicles and alerts">
          <section aria-labelledby="vehicles-title">
            <h2 id="vehicles-title" className="panel-title">Vehicles</h2>
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
          </section>

          <section aria-labelledby="alerts-title">
            <h2 id="alerts-title" className="panel-title">Geofence alerts</h2>
            {events.length === 0 ? (
              <p className="muted">No alerts yet. They appear when a vehicle enters or leaves a zone.</p>
            ) : (
              <ul className="alerts">
                {events.map((ev) => (
                  <li key={`${ev.timestamp}-${ev.vehicleId}-${ev.geofenceId}-${ev.type}`}>
                    <span className="clock">{formatElapsed(ev.timestamp)}</span>{" "}
                    <strong>{ev.vehicleId}</strong>{" "}
                    {ev.type === "enter" ? "entered" : "left"} {fenceName(ev.geofenceId)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <div className="content">
          <FleetMap vehicles={vehicles} />
          <section className="report" aria-labelledby="report-title">
            <h2 id="report-title" className="panel-title">
              Fleet report: completed trips and stops so far
            </h2>
            <table>
              <caption className="sr-only">
                Trips, distance, driving time, stops and stopped time per vehicle
              </caption>
              <thead>
                <tr>
                  <th scope="col">Vehicle</th>
                  <th scope="col">Trips</th>
                  <th scope="col">Distance</th>
                  <th scope="col">Driving</th>
                  <th scope="col">Stops</th>
                  <th scope="col">Stopped</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.vehicleId}>
                    <th scope="row">{r.vehicleId}</th>
                    <td>{r.trips}</td>
                    <td>{(r.distanceM / 1000).toFixed(1)} km</td>
                    <td>{formatDuration(r.drivingMs)}</td>
                    <td>{r.stops}</td>
                    <td>{formatDuration(r.stoppedMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}