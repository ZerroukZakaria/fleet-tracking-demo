import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEMO_GEOFENCES } from "@fleet/core";
import { TILE_ATTRIBUTION, TILE_URL } from "./config";
import { circlePolygon } from "./mapUtils";
import type { VehicleView } from "./useSimulation";

interface MarkerEntry {
  marker: maplibregl.Marker;
  el: HTMLElement;
}

export function FleetMap({ vehicles }: { vehicles: VehicleView[] }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, MarkerEntry>());

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
        paint: { "fill-color": "#f2b134", "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "geofences-line",
        type: "line",
        source: "geofences",
        paint: { "line-color": "#b07a00", "line-width": 2 },
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.current.clear();
    };
  }, []);

  // Create or move one marker per vehicle whenever positions change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const v of vehicles) {
      const { vehicleId, lon, lat } = v.position;
      let entry = markers.current.get(vehicleId);
      if (!entry) {
        const el = document.createElement("div");
        el.className = "vehicle-marker";
        const dot = document.createElement("span");
        dot.className = "dot";
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = vehicleId;
        el.append(dot, label);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(map);
        entry = { marker, el };
        markers.current.set(vehicleId, entry);
      }
      entry.marker.setLngLat([lon, lat]);
      entry.el.dataset.status = v.status;
    }
  }, [vehicles]);

  return <div ref={container} className="map" />;
}