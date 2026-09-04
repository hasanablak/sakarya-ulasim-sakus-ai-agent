import {
  lineIdFromSlug,
  type SakusLineListItem,
  type SakusRouteAndStops,
  type ScheduleDayPayload,
} from "@sakus/shared";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { launchBrowser, openSakusPage } from "./browser.js";
import { argValue, scraperConfig, sleep } from "./config.js";
import { collectLineList, collectLineSchedules, collectRouteAndStops } from "./intercept.js";

export type IngestOpts = {
  slug?: string;
  limit?: number;
  jobId?: number | null;
  onLog?: (obj: Record<string, unknown>) => void;
};

function log(opts: IngestOpts, obj: Record<string, unknown>): void {
  const row = { ts: new Date().toISOString(), ...obj };
  console.log(JSON.stringify(row));
  opts.onLog?.(row);
}

async function persistLine(
  line: SakusLineListItem,
  detail: SakusRouteAndStops,
  schedules: ScheduleDayPayload[],
): Promise<void> {
  const res = await fetch(`${scraperConfig.apiPublic}/api/internal/ingest/line`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": scraperConfig.internalSecret,
    },
    body: JSON.stringify({ line, detail, schedules }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`persist ${line.slug} HTTP ${res.status}: ${text}`);
  }
}

export async function runIngest(opts: IngestOpts = {}): Promise<void> {
  const slugFilter = opts.slug;
  const limit = opts.limit;
  const jobId = opts.jobId ?? null;
  const all = !slugFilter;

  const browser = await launchBrowser();
  const page = await openSakusPage(browser);

  try {
    log(opts, { type: "start", jobId, slug: slugFilter ?? null, all });
    const lines = await collectLineList(page);
    if (!lines.length) throw new Error("Hat listesi yakalanamadı");
    log(opts, { type: "lines", jobId, count: lines.length });

    let targets = lines;
    if (slugFilter) {
      const needle = slugFilter.toLowerCase();
      targets = lines.filter((l) => {
        const slug = (l.slug ?? "").toLowerCase();
        const kod = (l.lineNumber ?? "").toLowerCase();
        return slug === needle || kod === needle;
      });
      if (!targets.length) {
        const id = lineIdFromSlug(slugFilter);
        targets = id ? lines.filter((l) => l.id === id) : [];
      }
      if (!targets.length) throw new Error(`Hat bulunamadı: ${slugFilter}`);
    }
    if (limit && limit > 0) targets = targets.slice(0, limit);

    let current = 0;
    let failed = 0;
    for (const line of targets) {
      current += 1;
      log(opts, {
        type: "progress",
        jobId,
        current,
        total: targets.length,
        slug: line.slug,
        message: `${line.lineNumber ?? "?"} ${line.name ?? ""}`.trim(),
      });
      try {
        const detail = await collectRouteAndStops(page, line.id, line.slug);
        let schedules: ScheduleDayPayload[] = [];
        try {
          schedules = await collectLineSchedules(page, line.id);
        } catch (err) {
          log(opts, {
            type: "schedule.error",
            jobId,
            slug: line.slug,
            message: String((err as Error)?.message ?? err),
          });
        }
        await persistLine(line, detail, schedules);
      } catch (err) {
        failed += 1;
        log(opts, {
          type: "line.error",
          jobId,
          slug: line.slug,
          message: String((err as Error)?.message ?? err),
        });
      }
      if (current < targets.length) await sleep(scraperConfig.ingestDelayMs);
    }

    log(opts, { type: "done", jobId, total: targets.length, failed });
    if (failed === targets.length) throw new Error(`Hiç hat kaydedilemedi (${failed} hata)`);
    if (failed) log(opts, { type: "partial", jobId, failed, saved: targets.length - failed });
  } finally {
    await browser.close();
  }
}

const isCli = Boolean(
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]),
);
if (isCli) {
  runIngest({
    slug: argValue("--slug"),
    limit: argValue("--limit") ? Number(argValue("--limit")) : undefined,
    jobId: argValue("--job-id") ? Number(argValue("--job-id")) : null,
  }).catch((err) => {
    console.error(JSON.stringify({ type: "error", message: String(err?.message ?? err) }));
    process.exit(1);
  });
}
