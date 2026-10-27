import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 runs its worker from a separate file that Vite does not emit by
// itself. ?worker&url makes Vite bundle it and gives us its URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  DEMO_GEOFENCES,
  bearingDegrees,
  distanceMeters,
  type LatLon,
} from "@fleet/core";
import { TILE_ATTRIBUTION, TILE_URL } from "./config";
import { circlePolygon } from "./mapUtils";
import type { VehicleView } from "./useSimulation";

maplibregl.setWorkerUrl(workerUrl);

/** Heading only changes after the vehicle has moved this far (ignores GPS jitter). */
const MIN_HEADING_MOVE_M = 25;

// The map canvas is darkened with a CSS filter (see styles.css), which also
// changes colors drawn on it. This color comes out as light purple (#a58bff)
// after the filter, so the geofence looks right on the dark map.
const FENCE_COLOR = "#7258cc";

// Top-down vehicle shapes, pointing up. Constant strings, no user input.
const TRUCK_SVG = `<svg viewBox="0 0 20 40" aria-hidden="true">
  <rect class="body" x="3" y="14" width="14" height="24" rx="2"/>
  <rect class="body" x="4" y="2" width="12" height="11" rx="3"/>
  <rect class="glass" x="6" y="4" width="8" height="3" rx="1"/>
</svg>`;

const VAN_SVG = `<svg viewBox="0 0 20 32" aria-hidden="true">
  <rect class="body" x="3" y="2" width="14" height="28" rx="4"/>
  <rect class="glass" x="5" y="5" width="10" height="4" rx="1"/>
</svg>`;

interface MarkerEntry {
  marker: maplibregl.Marker;
  el: HTMLElement;
  icon: HTMLElement;
  anchor: LatLon;
  heading: number;
}

export function FleetMap({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: VehicleView[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, MarkerEntry>());

  // Latest values for use inside long-lived handlers and effects
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;
  const skipFirstPan = useRef(true);

  // Create the map once
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [TILE_URL],
            tileSize: 256,
            maxzoom: 19,
            attribution: TILE_ATTRIBUTION,
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      bounds: [
        [-7.66, 33.44],
        [-7.37, 33.7],
      ],
      fitBoundsOptions: { padding: 40 },
      // Attribution must stay visible, so no collapsed toggle
      attributionControl: { compact: false },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("geofences", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: DEMO_GEOFENCES.map((g) => circlePolygon(g.center, g.radiusM)),
        },
      });
      map.addLayer({
        id: "geofences-fill",
        type: "fill",
        source: "geofences",
        paint: { "fill-color": FENCE_COLOR, "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: "geofences-line",
        type: "line",
        source: "geofences",
        paint: { "line-color": FENCE_COLOR, "line-width": 2 },
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.current.clear();
    };
  }, []);

  // Create or move one marker per vehicle whenever positions or selection change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const v of vehicles) {
      const { vehicleId, lon, lat } = v.position;
      const here: LatLon = { lat, lon };
      let entry = markers.current.get(vehicleId);

      if (!entry) {
        const el = document.createElement("div");
        el.className = "vehicle-marker";
        el.addEventListener("click", () => onSelectRef.current(vehicleId));
        const icon = document.createElement("span");
        icon.className = "icon";
        icon.innerHTML = vehicleId.startsWith("van") ? VAN_SVG : TRUCK_SVG;
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = vehicleId;
        el.append(icon, label);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(map);
        entry = { marker, el, icon, anchor: here, heading: 0 };
        markers.current.set(vehicleId, entry);
      }

      // Update heading only after real movement, not GPS noise
      if (distanceMeters(entry.anchor, here) >= MIN_HEADING_MOVE_M) {
        entry.heading = bearingDegrees(entry.anchor, here);
        entry.anchor = here;
      }

      const selected = vehicleId === selectedId;
      entry.marker.setLngLat([lon, lat]);
      entry.icon.style.transform = `rotate(${entry.heading}deg)`;
      entry.el.dataset.status = v.status;
      entry.el.dataset.selected = String(selected);
      entry.el.style.zIndex = selected ? "2" : "1";
    }
  }, [vehicles, selectedId]);

  // Pan to the vehicle when the selection changes (not on first load)
  useEffect(() => {
    if (skipFirstPan.current) {
      skipFirstPan.current = false;
      return;
    }
    const map = mapRef.current;
    const v = vehiclesRef.current.find((x) => x.position.vehicleId === selectedId);
    if (!map || !v) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({
      center: [v.position.lon, v.position.lat],
      zoom: Math.max(map.getZoom(), 11),
      duration: reduceMotion ? 0 : 600,
    });
  }, [selectedId]);

  return <div ref={container} className="map" />;
}