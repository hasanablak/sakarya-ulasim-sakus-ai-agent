import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { HatlarOzet, type HatOzetData } from "./HatlarOzet";
import { IngestBanner } from "./IngestBanner";
import {
  btnPrimary,
  btnSecondary,
  cx,
  errText,
  inputCls,
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

type Hat = {
  id: number;
  kod: string;
  slug: string;
  ad: string;
  bus_type_name: string | null;
  last_ingested_at: string | null;
};

type Job = {
  id: number;
  status: string;
  error_text: string | null;
  progress_json: { line?: string } | string | null;
  started_at: string | null;
  finished_at: string | null;
};

export function HatlarPage() {
  const [hatlar, setHatlar] = useState<Hat[]>([]);
  const [q, setQ] = useState("");
  const [live, setLive] = useState<string[]>([]);
  const [ingestRunning, setIngestRunning] = useState(false);
  const [scraperUp, setScraperUp] = useState(true);
  const [lastJob, setLastJob] = useState<Job | null>(null);
  const [ozet, setOzet] = useState<HatOzetData | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const data = await api.adminHatlar(q || undefined);
    setHatlar(data.hatlar ?? []);
    setLive(data.live ?? []);
    setIngestRunning(Boolean(data.ingestRunning));
    setScraperUp(data.scraperUp !== false);
    setLastJob(data.lastJob ?? null);
    setOzet(data.ozet ?? null);
  }

  useEffect(() => {
    load().catch((e) => setMsg(String(e.message)));
  }, []);

  useEffect(() => {
    if (!ingestRunning && lastJob?.status !== "running") return;
    const t = setInterval(() => {
      load().catch(() => undefined);
    }, 2000);
    return () => clearInterval(t);
  }, [ingestRunning, lastJob?.status]);

  return (
    <div className={pageStack}>
      <header className={pageHead}>
        <div>
          <h1 className={pageTitle}>Otobüs hatları</h1>
          <p className={pageSub}>
            {hatlar.length} hat kayıtlı. Canlı: {live.length ? live.join(", ") : "yok"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={ingestRunning || !scraperUp}
            onClick={async () => {
              setMsg(null);
              try {
                const r = await api.ingest({});
                setMsg(`İş #${r.jobId} kuyruğa alındı. Puppeteer SAKUS’tan çekiyor.`);
                setIngestRunning(true);
              } catch (e) {
                setMsg(String((e as Error).message));
              }
            }}
          >
            Tüm hatları SAKUS’tan çek
          </button>
        </div>
      </header>
      {lastJob && <IngestBanner job={lastJob} />}
      {ozet && <HatlarOzet ozet={ozet} liveCount={live.length} scraperUp={scraperUp} />}
      {msg && lastJob?.status !== "running" && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">{msg}</p>
      )}
      {!scraperUp && (
        <p className={errText}>Puppeteer konteyneri kapalı. `docker compose up -d --build scraper` çalıştır.</p>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load().catch((err) => setMsg(String(err.message)));
        }}
      >
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kod, ad, slug ara" />
        <button type="submit" className={btnSecondary}>
          Ara
        </button>
      </form>
      <div className={tableWrap}>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={thCls}>Kod</th>
              <th className={thCls}>Ad</th>
              <th className={thCls}>Son çekim</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {hatlar.map((h) => (
              <tr key={h.id} className={trCls}>
                <td className={tdCls}>
                  <strong>{h.kod}</strong>
                </td>
                <td className={tdCls}>
                  {h.ad}
                  <div className={cx(muted, "text-xs")}>{h.bus_type_name}</div>
                </td>
                <td className={cx(tdCls, muted)}>
                  {h.last_ingested_at ? new Date(h.last_ingested_at).toLocaleString("tr-TR") : "—"}
                </td>
                <td className={tdCls}>
                  <Link className={linkCls} to={`/admin/hatlar/${h.slug}`}>
                    Detay
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
