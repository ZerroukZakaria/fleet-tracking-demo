import type { GeofenceEvent, Segment, VehicleReport } from "@fleet/core";
import {
  fenceName,
  formatCoord,
  formatDuration,
  formatElapsed,
  formatKm,
  vehicleType,
} from "./format";
import type { VehicleView } from "./useSimulation";

interface Entry {
  key: string;
  time: number;
  kind: "trip" | "stop" | "event";
  title: string;
  when: string;
  detail: string;
}

export function VehicleDetail({
  view,
  row,
  segments,
  events,
}: {
  view: VehicleView | undefined;
  row: VehicleReport | undefined;
  segments: Segment[];
  events: GeofenceEvent[];
}) {
  if (!view) return null;
  const { position: p, status } = view;

  const entries: Entry[] = [
    ...segments.map((s): Entry => {
      const duration = formatDuration(s.endTime - s.startTime);
      return {
        key: `${s.kind}-${s.startTime}`,
        time: s.startTime,
        kind: s.kind,
        title: s.kind === "trip" ? "Trip" : "Stop",
        when: `${formatElapsed(s.startTime)} – ${formatElapsed(s.endTime)}`,
        detail:
          s.kind === "trip"
            ? `${formatKm(s.distanceM)} · ${duration}`
            : `${duration} at ${formatCoord(s.position.lat)}, ${formatCoord(s.position.lon)}`,
      };
    }),
    ...events.map(
      (e): Entry => ({
        key: `ev-${e.timestamp}-${e.geofenceId}-${e.type}`,
        time: e.timestamp,
        kind: "event",
        title: `${e.type === "enter" ? "Entered" : "Left"} ${fenceName(e.geofenceId)}`,
        when: formatElapsed(e.timestamp),
        detail: "",
      }),
    ),
  ].sort((a, b) => b.time - a.time);

  return (
    <aside className="detail" aria-label={`Details for ${p.vehicleId}`}>
      <p className="eyebrow">Selected vehicle</p>
      <h2 className="vtitle">{p.vehicleId}</h2>
      <div className="chips">
        <span className="chip">{vehicleType(p.vehicleId)}</span>
        <span className="chip" data-tone={status}>{status}</span>
      </div>

      <dl className="facts">
        <div>
          <dt>Speed</dt>
          <dd>{Math.round(p.speedKmh ?? 0)} km/h</dd>
        </div>
        <div>
          <dt>Trips</dt>
          <dd>{row?.trips ?? 0}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{formatKm(row?.distanceM ?? 0)}</dd>
        </div>
        <div>
          <dt>Driving</dt>
          <dd>{formatDuration(row?.drivingMs ?? 0)}</dd>
        </div>
        <div>
          <dt>Stops</dt>
          <dd>{row?.stops ?? 0}</dd>
        </div>
        <div>
          <dt>Stopped</dt>
          <dd>{formatDuration(row?.stoppedMs ?? 0)}</dd>
        </div>
        <div className="wide">
          <dt>Position</dt>
          <dd className="mono">
            {formatCoord(p.lat)}, {formatCoord(p.lon)}
          </dd>
        </div>
      </dl>

      <h3 className="eyebrow">Timeline</h3>
      {entries.length === 0 ? (
        <p className="muted">
          Nothing completed yet. Trips and stops appear a few minutes after they finish.
        </p>
      ) : (
        <ol className="timeline">
          {entries.map((e) => (
            <li key={e.key} className="tl-item" data-kind={e.kind}>
              <div className="tl-card">
                <p className="tl-title">{e.title}</p>
                <p className="mono muted tl-when">{e.when}</p>
                {e.detail && <p className="muted tl-detail">{e.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}