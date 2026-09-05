import { useEffect, useState } from "react";
import { api } from "../../api";
import { HatlarOzet, type HatOzetData } from "./HatlarOzet";
import { IngestBanner } from "./IngestBanner";
import { btnPrimary, errText, pageHead, pageStack, pageSub, pageTitle } from "./ui";

type Job = {
  id: number;
  status: string;
  error_text: string | null;
  progress_json: { line?: string } | string | null;
  started_at: string | null;
  finished_at: string | null;
};

export function DashboardPage() {
  const [live, setLive] = useState<string[]>([]);
  const [ingestRunning, setIngestRunning] = useState(false);
  const [scraperUp, setScraperUp] = useState(true);
  const [lastJob, setLastJob] = useState<Job | null>(null);
  const [ozet, setOzet] = useState<HatOzetData | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const data = await api.adminHatlar();
    setLive(data.live ?? []);
    setIngestRunning(Boolean(data.ingestRunning));
    setScraperUp(data.scraperUp !== false);
    setLastJob(data.lastJob ?? null);
    setOzet(data.ozet ?? null);
  }

  useEffect(() => {
    load().catch((e) => setMsg(String((e as Error).message)));
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
          <h1 className={pageTitle}>Özet</h1>
          <p className={pageSub}>Canlı takip: {live.length ? live.join(", ") : "yok"}</p>
        </div>
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
      </header>
      {lastJob && <IngestBanner job={lastJob} />}
      {ozet && <HatlarOzet ozet={ozet} />}
      {msg && lastJob?.status !== "running" && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">{msg}</p>
      )}
      {!scraperUp && (
        <p className={errText}>Puppeteer konteyneri kapalı. `docker compose up -d --build scraper` çalıştır.</p>
      )}
    </div>
  );
}
