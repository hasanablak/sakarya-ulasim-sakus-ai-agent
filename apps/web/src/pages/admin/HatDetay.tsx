import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api } from "../../api";
import { HatMap, type FocusStop } from "./HatMap";
import { HatSaatleri, type Sefer } from "./HatSaatleri";
import { sakusHatHaritaUrl } from "@sakus/shared";

type Vehicle = {
  bus_number: number;
  plate: string | null;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  status: string | null;
  next_stop_name: string | null;
  route_name: string | null;
  updated_at: string;
};

export function HatDetayPage() {
  const { slug } = useParams();
  const [data, setData] = useState<{
    hat: { kod: string; ad: string; slug: string; bus_type_color: string | null };
    routes: { sakus_route_id: number; yon_ad: string; geometry_json?: unknown }[];
    stops: { sakus_route_id: number; id: number; sira: number; ad: string; lat: number; lng: number }[];
    vehicles: Vehicle[];
    seferler: Sefer[];
  } | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [liveOn, setLiveOn] = useState(false);
  const [focusStop, setFocusStop] = useState<FocusStop | null>(null);

  async function load() {
    if (!slug) return;
    const d = await api.adminHat(slug);
    setData(d);
    setVehicles(d.vehicles ?? []);
  }

  useEffect(() => {
    load().catch((e) => setMsg(String(e.message)));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const socket = io({ transports: ["websocket"] });
    socket.emit("subscribe.hat", slug);
    socket.on("arac.konum", (payload: { hatSlug: string; vehicles: { busNumber: number; plate: string | null; lat: number; lng: number; speed: number | null; heading: number | null; status: string | null; nextStopName: string | null; routeName: string | null; updatedAt: string }[] }) => {
      if (payload.hatSlug !== slug) return;
      setVehicles(
        payload.vehicles.map((v) => ({
          bus_number: v.busNumber,
          plate: v.plate,
          lat: v.lat,
          lng: v.lng,
          speed: v.speed,
          heading: v.heading,
          status: v.status,
          next_stop_name: v.nextStopName,
          route_name: v.routeName,
          updated_at: v.updatedAt,
        })),
      );
    });
    return () => {
      socket.close();
    };
  }, [slug]);

  if (!data?.hat) return <p>{msg ?? "Yükleniyor…"}</p>;
  const hat = data.hat;

  return (
    <div>
      <p>
        <Link to="/admin">← Hatlar</Link>
      </p>
      <header className="page-head">
        <div>
          <h1>
            {hat.kod} — {hat.ad}
          </h1>
          <p className="muted">{hat.slug}</p>
        </div>
        <div className="row">
          <a className="ghost" href={sakusHatHaritaUrl(hat.slug)} target="_blank" rel="noreferrer">
            SAKUS’ta göster
          </a>
          <button
            type="button"
            onClick={async () => {
              setMsg(null);
              try {
                const r = await api.ingest({ slug: hat.slug });
                setMsg(`Hat güncelleme başladı (iş #${r.jobId}).`);
              } catch (e) {
                setMsg(String((e as Error).message));
              }
            }}
          >
            Bu hattı güncelle
          </button>
          <button
            type="button"
            className={liveOn ? "danger" : ""}
            onClick={async () => {
              setMsg(null);
              try {
                if (liveOn) {
                  await api.liveStop(hat.slug);
                  setLiveOn(false);
                  setMsg("Canlı takip durdu.");
                } else {
                  await api.liveStart(hat.slug);
                  setLiveOn(true);
                  setMsg("Canlı takip açıldı. Puppeteer SAKUS sayfasını dinliyor.");
                }
              } catch (e) {
                setMsg(String((e as Error).message));
              }
            }}
          >
            {liveOn ? "Canlıyı durdur" : "Canlı takibi aç"}
          </button>
        </div>
      </header>
      {msg && <p className="banner">{msg}</p>}

      <h2>Güzergah haritası</h2>
      <HatMap
        key={hat.slug}
        routes={data.routes ?? []}
        stops={data.stops ?? []}
        vehicles={vehicles}
        hatColor={hat.bus_type_color}
        focusStop={focusStop}
      />

      <h2>Hareket saatleri</h2>
      <HatSaatleri slug={hat.slug} seferler={data.seferler ?? []} />

      <h2>Anlık otobüsler</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Araç</th>
            <th>Durum</th>
            <th>Konum</th>
            <th>Güncelleme</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Kayıt yok. Canlı takibi aç.
              </td>
            </tr>
          )}
          {vehicles.map((v) => (
            <tr key={v.bus_number}>
              <td>
                {v.bus_number}
                {v.plate ? ` · ${v.plate}` : ""}
              </td>
              <td>
                {v.status} {v.next_stop_name ? `→ ${v.next_stop_name}` : ""}
                <div className="muted">{v.route_name}</div>
              </td>
              <td className="muted">
                {Number(v.lat).toFixed(5)}, {Number(v.lng).toFixed(5)}
              </td>
              <td className="muted">{new Date(v.updated_at).toLocaleTimeString("tr-TR")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Güzergah durakları</h2>
      {(data.routes ?? []).map((r) => (
        <section key={r.sakus_route_id} className="route-block">
          <h3>{r.yon_ad}</h3>
          <ol className="stops">
            {(data.stops ?? [])
              .filter((s) => s.sakus_route_id === r.sakus_route_id)
              .map((s) => (
                <li
                  key={`${r.sakus_route_id}-${s.id}`}
                  onClick={() => setFocusStop({ lat: Number(s.lat), lng: Number(s.lng), ad: s.ad })}
                >
                  <span>{s.ad}</span>
                  <em>
                    {Number(s.lat).toFixed(5)}, {Number(s.lng).toFixed(5)}
                  </em>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
