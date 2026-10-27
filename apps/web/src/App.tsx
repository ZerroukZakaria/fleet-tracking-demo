import { useMemo, useState, type KeyboardEvent } from "react";
import { DEMO_PLANS, buildReport } from "@fleet/core";
import { FleetMap } from "./FleetMap";
import { useSimulation } from "./useSimulation";
import { formatElapsed } from "./format";
import { AlertsList, ReportTable, VehicleList } from "./panels";
import { VehicleDetail } from "./VehicleDetail";

const SPEEDS = [10, 60, 120];
const VEHICLE_IDS = DEMO_PLANS.map((p) => p.id);

const TABS = [
  { id: "vehicles", label: "Vehicles" },
  { id: "alerts", label: "Alerts" },
  { id: "report", label: "Report" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(60);
  const [selectedId, setSelectedId] = useState(VEHICLE_IDS[0]);
  const [tab, setTab] = useState<TabId>("vehicles");

  const { vehicles, elapsedMs, events, segments } = useSimulation(speed, running);
  const report = useMemo(() => buildReport(segments, VEHICLE_IDS), [segments]);

  const selectedView = vehicles.find((v) => v.position.vehicleId === selectedId);
  const selectedRow = report.find((r) => r.vehicleId === selectedId);
  const selectedSegments = useMemo(
    () => segments.filter((s) => s.vehicleId === selectedId),
    [segments, selectedId],
  );
  const selectedEvents = useMemo(
    () => events.filter((e) => e.vehicleId === selectedId),
    [events, selectedId],
  );

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next: number;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else return;
    e.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`tab-${TABS[next].id}`)?.focus();
  };

  return (
    <div className="app">
      <header className="bar">
        <h1>Fleet tracking demo</h1>
        <button type="button" className="primary" onClick={() => setRunning((r) => !r)}>
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
        <span className="mono muted">Simulated time {formatElapsed(elapsedMs)}</span>
        <span className="muted bar-note">Synthetic data</span>
      </header>

      <div className="workspace">
        <div className="left">
          <FleetMap vehicles={vehicles} selectedId={selectedId} onSelect={setSelectedId} />

          <div className="tabs-area">
            <div className="tablist" role="tablist" aria-label="Fleet data">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  type="button"
                  role="tab"
                  className="tab"
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={onTabKeyDown}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div
              id={`panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              className="tabpanel"
              tabIndex={0}
            >
              {tab === "vehicles" && (
                <VehicleList
                  vehicles={vehicles}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
              {tab === "alerts" && <AlertsList events={events} />}
              {tab === "report" && <ReportTable report={report} />}
            </div>
          </div>
        </div>

        <VehicleDetail
          view={selectedView}
          row={selectedRow}
          segments={selectedSegments}
          events={selectedEvents}
        />
      </div>
    </div>
  );
}