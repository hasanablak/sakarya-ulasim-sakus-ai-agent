import { useMemo, useState } from "react";
import { GUN_KODLARI, type GunKod, ulasimHatSaatUrl } from "@sakus/shared";
import { btnPrimary, btnSecondary, cardShell, cx, muted, tableCls, tableWrap, tdCls, thCls, trCls } from "./ui";

export type Sefer = {
  sakus_route_id: number;
  yon_ad: string;
  gun_kod: GunKod | string;
  ornek_tarih: string | null;
  sefer_no: number | null;
  kalkis: string;
  varis: string | null;
  aciklama: string | null;
};

const GUN_AD: Record<string, string> = {
  haftaici: "Hafta içi",
  cumartesi: "Cumartesi",
  pazar: "Pazar",
};

function hhmm(raw: string | null | undefined): string {
  if (!raw) return "—";
  const s = String(raw);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return s.slice(0, 5);
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function toMinutes(raw: string | null | undefined): number | null {
  const t = hhmm(raw);
  const m = t.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function todayGunKod(): GunKod {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(new Date());
  if (wd === "Sat") return "cumartesi";
  if (wd === "Sun") return "pazar";
  return "haftaici";
}

function nowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function HatSaatleri({ slug, seferler }: { slug: string; seferler: Sefer[] }) {
  const today = todayGunKod();
  const [gun, setGun] = useState<string>(seferler.some((s) => s.gun_kod === today) ? today : GUN_KODLARI[0]);
  const now = nowMinutes();

  const byGun = useMemo(() => {
    const map = new Map<string, Sefer[]>();
    for (const s of seferler) {
      const list = map.get(s.gun_kod) ?? [];
      list.push(s);
      map.set(s.gun_kod, list);
    }
    return map;
  }, [seferler]);

  const rows = byGun.get(gun) ?? [];
  const routes = [...new Map(rows.map((r) => [r.sakus_route_id, r.yon_ad])).entries()];

  return (
    <section className={cx(cardShell, "overflow-hidden")}>
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
        {GUN_KODLARI.map((g) => (
          <button key={g} type="button" className={gun === g ? btnPrimary : btnSecondary} onClick={() => setGun(g)}>
            {GUN_AD[g]}
            <em className="ml-1.5 text-xs not-italic opacity-70">{byGun.get(g)?.length ?? 0}</em>
          </button>
        ))}
        <a className={cx(btnSecondary, "ml-auto")} href={ulasimHatSaatUrl(slug)} target="_blank" rel="noreferrer">
          Portalda saatler
        </a>
      </div>
      {rows.length === 0 ? (
        <p className={cx(muted, "p-4")}>
          {seferler.length === 0
            ? "Saatler henüz çekilmedi. “Bu hattı güncelle” ile SAKUS’tan sefer saatlerini al."
            : `${GUN_AD[gun] ?? gun} için sefer yok.`}
        </p>
      ) : (
        routes.map(([routeId, yon]) => {
          const trips = rows.filter((r) => r.sakus_route_id === routeId);
          const nextTime =
            gun === today
              ? trips.reduce<string | null>((best, t) => {
                  const mins = toMinutes(t.kalkis);
                  if (mins == null || mins < now) return best;
                  const label = hhmm(t.kalkis);
                  if (!best) return label;
                  return (toMinutes(label) ?? 99_999) < (toMinutes(best) ?? 99_999) ? label : best;
                }, null)
              : null;
          return (
            <div key={`${gun}-${routeId}`} className="px-4 pb-4 pt-1">
              <h3 className="mt-3.5 text-base font-semibold text-zinc-900 dark:text-zinc-50">{yon}</h3>
              <div className={cx(tableWrap, "mt-2")}>
                <table className={tableCls}>
                  <thead>
                    <tr>
                      <th className={thCls}>Kalkış</th>
                      <th className={thCls}>Varış</th>
                      <th className={thCls}>Sefer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {trips.map((t) => {
                      const isNext = nextTime != null && hhmm(t.kalkis) === nextTime;
                      return (
                        <tr key={`${t.gun_kod}-${t.sakus_route_id}-${t.sefer_no}-${t.kalkis}`} className={cx(trCls, isNext && "bg-emerald-500/10")}>
                          <td className={tdCls}>
                            <strong>{hhmm(t.kalkis)}</strong>
                            {isNext && (
                              <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                                sıradaki
                              </span>
                            )}
                          </td>
                          <td className={cx(tdCls, muted)}>{hhmm(t.varis)}</td>
                          <td className={cx(tdCls, muted)}>{t.sefer_no ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
