import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api } from "../../api";
import { HatMap, type FocusStop } from "./HatMap";
import { HatSaatleri, type Sefer } from "./HatSaatleri";
import { sakusHatHaritaUrl } from "@sakus/shared";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  cardShell,
  cx,
  linkCls,
  muted,
  pageHead,
  pageStack,
  pageSub,
  pageTitle,
  tableCls,
  tableWrap,
  tdCls,
  thCls,
  trCls,
} from "./ui";

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

  if (!data?.hat) return <p className="text-zinc-500">{msg ?? "Yükleniyor…"}</p>;
  const hat = data.hat;

  return (
    <div className={pageStack}>
      <p>
        <Link className={linkCls} to="/admin/hatlar">
          ← Hatlar
        </Link>
      </p>
      <header className={pageHead}>
        <div>
          <h1 className={pageTitle}>
            {hat.kod} — {hat.ad}
          </h1>
          <p className={pageSub}>{hat.slug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a className={btnSecondary} href={sakusHatHaritaUrl(hat.slug)} target="_blank" rel="noreferrer">
            SAKUS’ta göster
          </a>
          <button
            type="button"
            className={btnPrimary}
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
            className={liveOn ? btnDanger : btnPrimary}
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
      {msg && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">{msg}</p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:h-[min(560px,70vh)]">
        <div className="h-[min(480px,55vh)] min-h-0 lg:col-span-3 lg:h-full">
          <HatMap
            key={hat.slug}
            routes={data.routes ?? []}
            stops={data.stops ?? []}
            vehicles={vehicles}
            hatColor={hat.bus_type_color}
            focusStop={focusStop}
          />
        </div>
        <section className={cx(cardShell, "flex h-[min(480px,55vh)] min-h-0 flex-col overflow-hidden lg:h-full")}>
          <h2 className="shrink-0 border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
            Güzergah durakları
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {(data.routes ?? []).length === 0 ? (
              <p className={cx(muted, "px-1 py-2 text-sm")}>Bu hat için durak kaydı yok.</p>
            ) : (
              (data.routes ?? []).map((r) => (
                <div key={r.sakus_route_id} className="mb-4 last:mb-0">
                  <h3 className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{r.yon_ad}</h3>
                  <ol className="list-decimal space-y-0.5 pl-5">
                    {(data.stops ?? [])
                      .filter((s) => s.sakus_route_id === r.sakus_route_id)
                      .map((s) => (
                        <li
                          key={`${r.sakus_route_id}-${s.id}`}
                          className="-ml-1.5 cursor-pointer rounded-lg px-1.5 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          onClick={() => setFocusStop({ lat: Number(s.lat), lng: Number(s.lng), ad: s.ad })}
                        >
                          <span className="text-sm text-zinc-900 dark:text-zinc-50">{s.ad}</span>
                        </li>
                      ))}
                  </ol>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Hareket saatleri</h2>
      <HatSaatleri slug={hat.slug} seferler={data.seferler ?? []} />

      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Anlık otobüsler</h2>
      <div className={tableWrap}>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={thCls}>Araç</th>
              <th className={thCls}>Durum</th>
              <th className={thCls}>Konum</th>
              <th className={thCls}>Güncelleme</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={4} className={cx(tdCls, muted)}>
                  Kayıt yok. Canlı takibi aç.
                </td>
              </tr>
            )}
            {vehicles.map((v) => (
              <tr key={v.bus_number} className={trCls}>
                <td className={tdCls}>
                  {v.bus_number}
                  {v.plate ? ` · ${v.plate}` : ""}
                </td>
                <td className={tdCls}>
                  {v.status} {v.next_stop_name ? `→ ${v.next_stop_name}` : ""}
                  <div className={muted}>{v.route_name}</div>
                </td>
                <td className={cx(tdCls, muted)}>
                  {Number(v.lat).toFixed(5)}, {Number(v.lng).toFixed(5)}
                </td>
                <td className={cx(tdCls, muted)}>{new Date(v.updated_at).toLocaleTimeString("tr-TR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
