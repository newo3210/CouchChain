"use client";
import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { Control, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { RoutePlan, Waypoint } from "@/lib/types/route";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

const useLeafletRoutingMachine =
  process.env.NEXT_PUBLIC_USE_LEAFLET_ROUTING_MACHINE !== "false";

const OSRM_SERVICE_URL =
  process.env.NEXT_PUBLIC_LEAFLET_ROUTING_SERVICE_URL ??
  "https://router.project-osrm.org/route/v1";

/** Carto Positron (monocromático suave) o Voyager — no compite con la UI slate/off-white. */
const MAP_TILE_PRESET = process.env.NEXT_PUBLIC_MAP_STYLE ?? "positron";
const CARTO_TILES =
  MAP_TILE_PRESET === "voyager"
    ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const ROUTE_LINE = "#334155";
const MARKER = {
  origin: "#1e293b",
  destination: "#0f172a",
  stop: "#64748b",
} as const;

export type RouteMapHandle = {
  fitToPlan: () => void;
  focusWaypoint: (id: string) => void;
};

interface RouteMapProps {
  plan: RoutePlan | null;
  onWaypointDrag?: (waypointId: string, lat: number, lng: number) => void;
  onMapInteract?: () => void;
}

const RouteMap = forwardRef<RouteMapHandle, RouteMapProps>(function RouteMap(
  { plan, onWaypointDrag, onMapInteract },
  ref,
) {
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const polylineRef = useRef<ReturnType<typeof import("leaflet")["polyline"]> | null>(null);
  const routingControlRef = useRef<
    (Control & {
      setWaypoints?: (latlngs: unknown[]) => void;
      on?: (ev: string, fn: () => void) => void;
    }) | null
  >(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<RoutePlan | null>(null);
  planRef.current = plan;

  useImperativeHandle(ref, () => ({
    fitToPlan() {
      const map = mapRef.current;
      const L = LRef.current;
      const p = planRef.current;
      if (!map || !L || !p?.waypoints.length) return;
      const g = L.latLngBounds(
        p.waypoints.map((w) => [w.lat, w.lng] as [number, number]),
      );
      if (g.isValid()) {
        map.flyToBounds(g, {
          padding: [52, 52],
          maxZoom: 14,
          duration: 0.85,
        });
      }
    },
    focusWaypoint(id: string) {
      const map = mapRef.current;
      const p = planRef.current;
      if (!map || !p) return;
      const w = p.waypoints.find((x) => x.id === id);
      if (!w) return;
      map.flyTo([w.lat, w.lng], Math.max(map.getZoom(), 13), {
        duration: 0.85,
        easeLinearity: 0.25,
      });
    },
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mapRef.current) return;
    if (!containerRef.current) return;

    (async () => {
      const leafletMod = await import("leaflet");
      const L = (leafletMod as { default: typeof import("leaflet") }).default;
      LRef.current = L;
      await import("leaflet/dist/leaflet.css");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [-40, -65],
        zoom: 5,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer(CARTO_TILES, {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      map.on("mousedown", () => onMapInteract?.());
      mapRef.current = map;
    })();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      LRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearRouting = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (routingControlRef.current) {
      try {
        map.removeControl(routingControlRef.current as unknown as Control);
      } catch {
        /* ignore */
      }
      routingControlRef.current = null;
    }
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
  }, []);

  const renderRoute = useCallback(async () => {
    if (!mapRef.current || !plan) return;
    const L = LRef.current;
    if (!L) return;
    const map = mapRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    await clearRouting();

    if (useLeafletRoutingMachine && plan.waypoints.length >= 2) {
      await import("leaflet-routing-machine");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const LR = (L as any).Routing;
      if (LR?.control && LR?.osrmv1) {
        const sorted = [...plan.waypoints].sort((a, b) => {
          const o = (t: Waypoint["type"]) =>
            t === "origin" ? 0 : t === "destination" ? 2 : 1;
          return o(a.type) - o(b.type);
        });
        const wps = sorted.map((w) => L.latLng(w.lat, w.lng));
        const control = LR.control({
          waypoints: wps,
          router: LR.osrmv1({ serviceUrl: OSRM_SERVICE_URL }),
          show: false,
          addWaypoints: false,
          routeWhileDragging: false,
          fitSelectedRoutes: false,
          lineOptions: {
            styles: [{ color: ROUTE_LINE, weight: 4, opacity: 0.88 }],
          },
        }).addTo(map) as Control & {
          setWaypoints?: (latlngs: unknown[]) => void;
          on?: (ev: string, fn: () => void) => void;
        };
        routingControlRef.current = control;
      }
    } else {
      const allCoords: [number, number][] = [];
      for (const seg of plan.transportSegments) {
        allCoords.push([seg.from.lat, seg.from.lng]);
        allCoords.push([seg.to.lat, seg.to.lng]);
      }
      if (allCoords.length >= 2) {
        const pl = L.polyline(allCoords, {
          color: ROUTE_LINE,
          weight: 4,
          opacity: 0.88,
        }).addTo(map);
        polylineRef.current = pl;
        map.flyToBounds(pl.getBounds(), { padding: [48, 48], duration: 0.75 });
      }
    }

    for (const wp of plan.waypoints) {
      const iconColor =
        wp.type === "origin"
          ? MARKER.origin
          : wp.type === "destination"
            ? MARKER.destination
            : MARKER.stop;
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
        <div style="font-family:system-ui,sans-serif;min-width:140px">
          <strong style="color:#0f172a">${wp.name}</strong>
          ${wp.type === "origin" ? "<br/><span style='color:#334155;font-size:0.75rem'>Origen</span>" : ""}
          ${wp.type === "destination" ? "<br/><span style='color:#1e293b;font-size:0.75rem'>Destino</span>" : ""}
          ${wp.type === "stop" ? "<br/><span style='color:#475569;font-size:0.75rem'>Parada</span>" : ""}
          ${wp.notes ? `<br/><span style='color:#64748b;font-size:0.8rem'>${wp.notes}</span>` : ""}
        </div>
      `);

      let debounceTimer: ReturnType<typeof setTimeout>;
      marker.on("dragend", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const { lat, lng } = marker.getLatLng();
          onWaypointDrag?.(wp.id, lat, lng);
          if (routingControlRef.current && "setWaypoints" in routingControlRef.current) {
            const ids = [...plan.waypoints].sort((a, b) => {
              const o = (t: Waypoint["type"]) =>
                t === "origin" ? 0 : t === "destination" ? 2 : 1;
              return o(a.type) - o(b.type);
            });
            const next = ids.map((w) =>
              w.id === wp.id ? L.latLng(lat, lng) : L.latLng(w.lat, w.lng),
            );
            (routingControlRef.current as { setWaypoints: (ll: typeof next) => void }).setWaypoints(next);
          }
        }, 600);
      });

      markersRef.current.set(wp.id, marker);
    }

    const fitAll = () => {
      try {
        if (routingControlRef.current && "on" in routingControlRef.current) {
          const rc = routingControlRef.current as unknown as {
            getBounds?: () => import("leaflet").LatLngBounds;
          };
          const b = rc.getBounds?.();
          if (b?.isValid()) {
            map.flyToBounds(b, {
              padding: [48, 48],
              maxZoom: 14,
              duration: 0.8,
            });
            return;
          }
        }
        if (polylineRef.current) {
          map.flyToBounds(polylineRef.current.getBounds(), {
            padding: [48, 48],
            duration: 0.75,
          });
          return;
        }
        if (plan.waypoints.length) {
          const g = L.latLngBounds(
            plan.waypoints.map((w) => [w.lat, w.lng] as [number, number]),
          );
          if (g.isValid()) {
            map.flyToBounds(g, {
              padding: [52, 52],
              maxZoom: 14,
              duration: 0.8,
            });
          }
        }
      } catch {
        /* ignore */
      }
    };

    if (routingControlRef.current && "on" in routingControlRef.current) {
      const rcEvents = routingControlRef.current as {
        on?: (ev: string, fn: () => void) => void;
      };
      rcEvents.on?.("routesfound", fitAll);
    } else {
      fitAll();
    }
  }, [plan, onWaypointDrag, clearRouting]);

  useEffect(() => {
    renderRoute();
  }, [renderRoute]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full min-h-[260px] overflow-hidden rounded-b-3xl"
    />
  );
});

export default RouteMap;
