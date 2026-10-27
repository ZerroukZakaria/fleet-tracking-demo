import type { GeofenceEvent, VehicleReport } from "@fleet/core";
import {
  fenceName,
  formatCoord,
  formatDuration,
  formatElapsed,
  formatKm,
  vehicleType,
} from "./format";
import type { VehicleView } from "./useSimulation";

export function VehicleList({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: VehicleView[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="vlist">
      {vehicles.map(({ position: p, status }) => (
        <li key={p.vehicleId}>
          <button
            type="button"
            className="vrow"
            aria-current={p.vehicleId === selectedId ? "true" : undefined}
            onClick={() => onSelect(p.vehicleId)}
          >
            <span className="dot" data-status={status} aria-hidden="true" />
            <span className="vmain">
              <strong>{p.vehicleId}</strong>
              <span className="muted mono">
                {formatCoord(p.lat)}, {formatCoord(p.lon)}
              </span>
            </span>
            <span className="chip">{vehicleType(p.vehicleId)}</span>
            <span className="chip" data-tone={status}>{status}</span>
            <span className="mono vspeed">{Math.round(p.speedKmh ?? 0)} km/h</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AlertsList({ events }: { events: GeofenceEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="muted">
        No alerts yet. They appear when a vehicle enters or leaves a zone.
      </p>
    );
  }
  return (
    <ul className="alerts">
      {events.map((ev) => (
        <li key={`${ev.timestamp}-${ev.vehicleId}-${ev.geofenceId}-${ev.type}`}>
          <span className="mono muted">{formatElapsed(ev.timestamp)}</span>
          <span>
            <strong>{ev.vehicleId}</strong> {ev.type === "enter" ? "entered" : "left"}{" "}
            {fenceName(ev.geofenceId)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReportTable({ report }: { report: VehicleReport[] }) {
  return (
    <table>
      <caption className="sr-only">
        Completed trips, distance, driving time, stops and stopped time per vehicle
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
            <td>{formatKm(r.distanceM)}</td>
            <td>{formatDuration(r.drivingMs)}</td>
            <td>{r.stops}</td>
            <td>{formatDuration(r.stoppedMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}