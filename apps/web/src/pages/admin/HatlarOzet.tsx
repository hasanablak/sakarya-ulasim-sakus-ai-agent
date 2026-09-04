import { cardCls, muted, trendDown, trendUp, trendWarn } from "./ui";

type Tur = { ad: string; n: number; renk: string | null };

export type HatOzetData = {
  hat: number;
  durak: number;
  guzergah: number;
  turler: Tur[];
  sonGuncelleme: string | null;
  bugunCekilen: number;
  eskiHat: number;
  arac: number;
  tazeArac: number;
  aracliHat: number;
};

function rel(iso: string | null): string {
  if (!iso) return "henüz yok";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const sa = Math.round(min / 60);
  if (sa < 24) return `${sa} sa önce`;
  const gun = Math.round(sa / 24);
  return `${gun} gün önce`;
}

export function HatlarOzet({
  ozet,
  liveCount,
  scraperUp,
}: {
  ozet: HatOzetData;
  liveCount: number;
  scraperUp: boolean;
}) {
  const turMax = Math.max(1, ...ozet.turler.map((t) => t.n));
  const tazePct = ozet.arac ? Math.round((ozet.tazeArac / ozet.arac) * 100) : 0;
  const tazeHatPct = ozet.hat ? Math.round(((ozet.hat - ozet.eskiHat) / ozet.hat) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article className={cardCls}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-zinc-500">Hat ağı</p>
          <span className={ozet.hat > 0 ? trendUp : trendWarn}>{ozet.durak} durak</span>
        </div>
        <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{ozet.hat}</p>
        <p className="mt-1 text-sm text-zinc-500">kayıtlı hat</p>
        <div className="mt-3 flex flex-col gap-1 text-sm text-zinc-500">
          <span>{ozet.guzergah} güzergah</span>
        </div>
      </article>

      <article className={cardCls}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-zinc-500">Hat türleri</p>
          <span className={ozet.turler.length ? trendUp : trendWarn}>{ozet.turler.length} grup</span>
        </div>
        <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{ozet.turler.length}</p>
        <p className="mt-1 text-sm text-zinc-500">grup</p>
        <ul className="mt-3 flex flex-col gap-2">
          {ozet.turler.length === 0 && <li className={muted}>Henüz hat yok</li>}
          {ozet.turler.map((t) => (
            <li key={t.ad}>
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-zinc-900 dark:text-zinc-50">{t.ad}</span>
                <em className="not-italic text-zinc-500">{t.n}</em>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <i
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(6, (t.n / turMax) * 100)}%`,
                    background: t.renk || "#4f46e5",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </article>

      <article className={cardCls}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-zinc-500">Güncellik</p>
          <span className={tazeHatPct >= 70 ? trendUp : tazeHatPct >= 40 ? trendWarn : trendDown}>%{tazeHatPct}</span>
        </div>
        <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{ozet.bugunCekilen}</p>
        <p className="mt-1 text-sm text-zinc-500">son 24 saatte çekilen</p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <i className="block h-full rounded-full bg-indigo-600" style={{ width: `${tazeHatPct}%` }} />
        </div>
        <div className="mt-2 flex flex-col gap-1 text-sm text-zinc-500">
          <span>Son: {rel(ozet.sonGuncelleme)}</span>
          <span>{ozet.eskiHat} hat 7 günden eski</span>
        </div>
      </article>

      <article className={cardCls}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-zinc-500">Canlı filo</p>
          <span className={scraperUp && tazePct >= 50 ? trendUp : scraperUp ? trendWarn : trendDown}>%{tazePct}</span>
        </div>
        <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{ozet.tazeArac}</p>
        <p className="mt-1 text-sm text-zinc-500">son 90 sn içinde konum</p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <i
            className={`block h-full rounded-full ${scraperUp ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${tazePct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-col gap-1 text-sm text-zinc-500">
          <span>
            {ozet.arac} kayıtlı araç · {ozet.aracliHat} hat
          </span>
          <span>{scraperUp ? `${liveCount} canlı takip` : "scraper kapalı"}</span>
        </div>
      </article>
    </div>
  );
}
