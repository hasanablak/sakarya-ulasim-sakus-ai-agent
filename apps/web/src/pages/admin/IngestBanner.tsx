type Job = {
  id: number;
  status: string;
  error_text: string | null;
  progress_json: { line?: string } | string | null;
  started_at: string | null;
  finished_at: string | null;
};

type ProgressEvent = {
  type?: string;
  current?: number;
  total?: number;
  slug?: string;
  message?: string;
  count?: number;
  failed?: number;
  saved?: number;
};

function parseProgress(raw: Job["progress_json"]): ProgressEvent | null {
  if (!raw) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { message: raw };
    }
  }
  if (obj && typeof obj === "object" && "line" in obj) {
    const line = (obj as { line: unknown }).line;
    if (typeof line === "string") {
      try {
        obj = JSON.parse(line);
      } catch {
        return { message: line };
      }
    } else if (line && typeof line === "object") {
      obj = line;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  return obj as ProgressEvent;
}

function statusLabel(status: string): string {
  if (status === "running") return "Çekiliyor";
  if (status === "success") return "Tamamlandı";
  if (status === "error") return "Hata";
  if (status === "queued") return "Kuyrukta";
  return status;
}

function shortError(text: string | null): string | null {
  if (!text) return null;
  const cut = text.replace(/\s+/g, " ").trim();
  return cut.length > 180 ? `${cut.slice(0, 177)}…` : cut;
}

function elapsed(iso: string | null): string | null {
  if (!iso) return null;
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (Number.isNaN(s)) return null;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m} dk ${r} sn` : `${r} sn`;
}

export function IngestBanner({ job }: { job: Job }) {
  const ev = parseProgress(job.progress_json);
  const current = ev?.current ?? 0;
  const total = ev?.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : job.status === "success" ? 100 : 0;
  const running = job.status === "running";
  const nowLine = ev?.message || (ev?.slug ? ev.slug : null);
  const err = shortError(job.error_text);

  let summary = "";
  if (ev?.type === "lines" && ev.count) summary = `${ev.count} hat listelendi`;
  else if (ev?.type === "done") {
    const saved = ev.saved ?? (ev.total != null && ev.failed != null ? ev.total - ev.failed : ev.total);
    summary = saved != null ? `${saved} hat kaydedildi` : "Bitti";
    if (ev.failed) summary += ` · ${ev.failed} atlandı`;
  } else if (ev?.type === "start") summary = "SAKUS’tan hat listesi alınıyor…";
  else if (ev?.type === "line.error") summary = ev.message ?? "Bir hat atlandı";
  else if (!running && total) summary = `${current} / ${total} hat işlendi`;

  return (
    <aside className={`job-banner is-${job.status}`}>
      <div className="job-banner-top">
        <span className={`job-chip ${running ? "pulse" : ""}`}>{statusLabel(job.status)}</span>
        <strong>İş #{job.id}</strong>
        {running && elapsed(job.started_at) && (
          <span className="muted">{elapsed(job.started_at)}</span>
        )}
        {total > 0 && (
          <span className="job-pct">
            {current} / {total} · %{pct}
          </span>
        )}
      </div>
      <div className="job-banner-bar" aria-hidden>
        <i style={{ width: `${running && pct === 0 ? 8 : pct}%` }} />
      </div>
      {running && nowLine && <p className="job-now">Şu an: {nowLine}</p>}
      {!running && summary && <p className="job-now">{summary}</p>}
      {running && !nowLine && summary && <p className="job-now">{summary}</p>}
      {err && <p className="job-err">{err}</p>}
    </aside>
  );
}
