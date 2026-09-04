import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type HatMapRoute = {
  sakus_route_id: number;
  yon_ad: string;
  geometry_json?: unknown;
};

export type HatMapStop = {
  sakus_route_id: number;
  id: number;
  sira: number;
  ad: string;
  lat: number | string;
  lng: number | string;
};

export type HatMapVehicle = {
  bus_number: number;
  plate: string | null;
  lat: number | string;
  lng: number | string;
  heading?: number | string | null;
  status: string | null;
  next_stop_name: string | null;
};

export type FocusStop = { lat: number; lng: number; ad: string };

type Geom = { type?: string; coordinates?: unknown };

const DIR_COLORS = ["#1f4a3d", "#b85c38"];
const SAKARYA: L.LatLngExpression = [40.767, 30.4033];

function num(n: number | string): number {
  return typeof n === "number" ? n : Number(n);
}

function parseGeom(raw: unknown): Geom | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Geom;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Geom;
  return null;
}

function toLatLngs(geom: Geom): L.LatLngExpression[][] {
  const coords = geom.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const asLine = (line: unknown): L.LatLngExpression[] => {
    if (!Array.isArray(line)) return [];
    const out: L.LatLngExpression[] = [];
    for (const p of line) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const lng = Number(p[0]);
      const lat = Number(p[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
    }
    return out;
  };
  if (geom.type === "LineString") {
    const line = asLine(coords);
    return line.length ? [line] : [];
  }
  if (geom.type === "MultiLineString") {
    return coords.map(asLine).filter((line) => line.length > 1);
  }
  return [];
}

function routeColor(i: number, hatColor: string | null): string {
  return i === 0 && hatColor ? hatColor : DIR_COLORS[i % DIR_COLORS.length];
}

function busIcon(heading: number): L.DivIcon {
  const deg = Number.isFinite(heading) ? heading - 90 : -90;
  return L.divIcon({
    className: "hat-bus-icon",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div class="hat-bus-rot" style="transform:rotate(${deg}deg)">🚐</div>`,
  });
}

export function HatMap({
  routes,
  stops,
  vehicles,
  hatColor,
  focusStop,
}: {
  routes: HatMapRoute[];
  stops: HatMapStop[];
  vehicles: HatMapVehicle[];
  hatColor: string | null;
  focusStop: FocusStop | null;
}) {
  const [active, setActive] = useState<number | "all">("all");
  const [ready, setReady] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routesLayer = useRef<L.LayerGroup | null>(null);
  const stopsLayer = useRef<L.LayerGroup | null>(null);
  const vehiclesLayer = useRef<L.LayerGroup | null>(null);
  const fittedKey = useRef("");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, { scrollWheelZoom: true }).setView(SAKARYA, 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    routesLayer.current = L.layerGroup().addTo(map);
    stopsLayer.current = L.layerGroup().addTo(map);
    vehiclesLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setReady(true);

    const invalidate = () => map.invalidateSize();
    const t = window.setTimeout(invalidate, 80);
    const ro = new ResizeObserver(invalidate);
    ro.observe(el);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      routesLayer.current = null;
      stopsLayer.current = null;
      vehiclesLayer.current = null;
      fittedKey.current = "";
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const rLayer = routesLayer.current;
    const sLayer = stopsLayer.current;
    if (!ready || !map || !rLayer || !sLayer) return;

    rLayer.clearLayers();
    sLayer.clearLayers();
    const bounds = L.latLngBounds([]);

    routes.forEach((r, i) => {
      if (active !== "all" && r.sakus_route_id !== active) return;
      const geom = parseGeom(r.geometry_json);
      if (!geom) return;
      const color = routeColor(i, hatColor);
      for (const line of toLatLngs(geom)) {
        const pl = L.polyline(line, {
          color,
          weight: 5,
          opacity: 0.92,
          lineJoin: "round",
          dashArray: i === 0 ? undefined : "10 8",
        });
        pl.bindPopup(r.yon_ad);
        pl.addTo(rLayer);
        bounds.extend(pl.getBounds());
      }
    });

    const seen = new Set<number>();
    for (const s of stops) {
      if (active !== "all" && s.sakus_route_id !== active) continue;
      if (active === "all" && seen.has(s.id)) continue;
      seen.add(s.id);
      const lat = num(s.lat);
      const lng = num(s.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const idx = routes.findIndex((r) => r.sakus_route_id === s.sakus_route_id);
      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        color: routeColor(Math.max(0, idx), hatColor),
        weight: 2,
        fillColor: "#fffaf2",
        fillOpacity: 1,
      });
      marker.bindPopup(`#${s.sira} · ${s.ad}`);
      marker.addTo(sLayer);
      bounds.extend([lat, lng]);
    }

    const key = `${active}|${routes.map((r) => r.sakus_route_id).join(",")}`;
    if (bounds.isValid() && fittedKey.current !== key) {
      fittedKey.current = key;
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
    }
    map.invalidateSize();
  }, [ready, routes, stops, active, hatColor]);

  useEffect(() => {
    const vLayer = vehiclesLayer.current;
    if (!ready || !vLayer) return;
    vLayer.clearLayers();
    for (const v of vehicles) {
      const lat = num(v.lat);
      const lng = num(v.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const label = v.plate || String(v.bus_number);
      const heading = num(v.heading ?? 0);
      const marker = L.marker([lat, lng], {
        icon: busIcon(heading),
        zIndexOffset: 800,
        title: label,
      });
      const next = v.next_stop_name ? ` → ${v.next_stop_name}` : "";
      const yon = Number.isFinite(heading) ? ` · ${Math.round(heading)}°` : "";
      marker.bindPopup(`${label}${v.status ? ` · ${v.status}` : ""}${yon}${next}`);
      marker.bindTooltip(label, { permanent: true, direction: "top", offset: [0, -12], className: "hat-bus-label" });
      marker.addTo(vLayer);
    }
  }, [ready, vehicles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focusStop) return;
    map.setView([focusStop.lat, focusStop.lng], Math.max(map.getZoom(), 16), { animate: true });
    L.popup().setLatLng([focusStop.lat, focusStop.lng]).setContent(focusStop.ad).openOn(map);
  }, [ready, focusStop]);

  const empty = routes.length === 0 && stops.length === 0;

  return (
    <section className="hat-map-card">
      <div className="hat-map-toolbar">
        <button type="button" className={active === "all" ? "active" : ""} onClick={() => setActive("all")}>
          Tüm yönler
        </button>
        {routes.map((r, i) => (
          <button
            key={r.sakus_route_id}
            type="button"
            className={active === r.sakus_route_id ? "active" : ""}
            onClick={() => setActive(r.sakus_route_id)}
          >
            <i className="hat-swatch" style={{ background: routeColor(i, hatColor) }} />
            {r.yon_ad}
          </button>
        ))}
      </div>
      <div className="hat-map" ref={wrapRef} />
      {empty && <p className="hat-map-empty">Bu hat için güzergah veya durak geometrisi yok.</p>}
    </section>
  );
}
