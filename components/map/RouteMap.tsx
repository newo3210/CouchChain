"use client";
import { useEffect, useRef, useCallback } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { RoutePlan, Waypoint } from "@/lib/types/route";

interface RouteMapProps {
  plan: RoutePlan | null;
  onWaypointDrag?: (waypointId: string, lat: number, lng: number) => void;
  onMapInteract?: () => void;
}

export default function RouteMap({
  plan,
  onWaypointDrag,
  onMapInteract,
}: RouteMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const polylineRef = useRef<ReturnType<typeof import("leaflet")["polyline"]> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy-load Leaflet (SSR safe)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mapRef.current) return;
    if (!containerRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      // Fix default icon paths for Next.js
      // @ts-expect-error - leaflet internal
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [-40, -65],
        zoom: 5,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      map.on("mousedown", () => onMapInteract?.());
      mapRef.current = map;
    })();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderRoute = useCallback(async () => {
    if (!mapRef.current || !plan) return;
    const L = (await import("leaflet")).default;
    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Build polyline from all segments
    const allCoords: [number, number][] = [];
    for (const seg of plan.transportSegments) {
      allCoords.push([seg.from.lat, seg.from.lng]);
      allCoords.push([seg.to.lat, seg.to.lng]);
    }

    if (allCoords.length >= 2) {
      polylineRef.current = L.polyline(allCoords, {
        color: "#8B7355",
        weight: 4,
        opacity: 0.85,
        dashArray: undefined,
      }).addTo(map);
      map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
    }

    // Add draggable markers
    for (const wp of plan.waypoints) {
      const iconColor = wp.type === "origin" ? "#6B8E6B" : "#B85C5C";
      const marker = L.marker([wp.lat, wp.lng], {
        draggable: true,
        title: wp.name,
        icon: L.divIcon({
          className: "",
          html: `<div style="
            width:24px;height:24px;border-radius:50% 50% 50% 0;
            background:${iconColor};border:2px solid #fff;
            box-shadow:0 2px 4px rgba(0,0,0,0.3);
            transform:rotate(-45deg);
          "></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        }),
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family:Inter,sans-serif;min-width:140px">
          <strong style="color:#1a1a1a">${wp.name}</strong>
          ${wp.type === "origin" ? "<br/><span style='color:#6B8E6B;font-size:0.75rem'>Origen</span>" : ""}
          ${wp.type === "destination" ? "<br/><span style='color:#B85C5C;font-size:0.75rem'>Destino</span>" : ""}
          ${wp.notes ? `<br/><span style='color:#5c5c5c;font-size:0.8rem'>${wp.notes}</span>` : ""}
        </div>
      `);

      let debounceTimer: ReturnType<typeof setTimeout>;
      marker.on("dragend", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const { lat, lng } = marker.getLatLng();
          onWaypointDrag?.(wp.id, lat, lng);
        }, 600);
      });

      markersRef.current.set(wp.id, marker);
    }
  }, [plan, onWaypointDrag]);

  useEffect(() => {
    renderRoute();
  }, [renderRoute]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: "400px" }}
    />
  );
}
