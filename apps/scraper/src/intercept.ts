import type { HTTPResponse, Page } from "puppeteer";
import {
  isLineListUrl,
  isRouteStopsUrl,
  isVehicleTrackingUrl,
  parseSseVehicles,
  scheduleQueryDates,
  type SakusLineListItem,
  type SakusLineSchedule,
  type SakusRouteAndStops,
  type SakusVehicle,
  type ScheduleDayPayload,
} from "@sakus/shared";
import { scraperConfig } from "./config.js";

export async function readJson<T>(res: HTTPResponse): Promise<T | null> {
  try {
    const ctype = res.headers()["content-type"] ?? "";
    if (ctype.includes("text/event-stream")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function readVehicles(res: HTTPResponse): Promise<SakusVehicle[]> {
  const ctype = res.headers()["content-type"] ?? "";
  if (ctype.includes("text/event-stream")) {
    try {
      const text = await res.text();
      return parseSseVehicles(text);
    } catch {
      return [];
    }
  }
  const data = await readJson<SakusVehicle[] | SakusVehicle>(res);
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

export function attachVehicleListener(
  page: Page,
  onVehicles: (vehicles: SakusVehicle[], url: string, source: "sse" | "poll") => void,
): () => void {
  const handler = async (res: HTTPResponse) => {
    if (!isVehicleTrackingUrl(res.url()) || !res.ok()) return;
    const vehicles = await readVehicles(res);
    if (!vehicles.length) return;
    const source = res.url().includes("vehicle-tracking/stream") ? "sse" : "poll";
    onVehicles(vehicles, res.url(), source);
  };
  page.on("response", handler);
  return () => page.off("response", handler);
}

/** Sayfa origin'inden SAKUS public API çağrısı — intercept yakalar. */
export async function triggerLineLists(page: Page): Promise<void> {
  const api = scraperConfig.sakusApi;
  await page.evaluate(async (base) => {
    await Promise.all([
      fetch(`${base}/api/v1/Ulasim?busType=3869`),
      fetch(`${base}/api/v1/Ulasim?busType=5731`),
    ]);
  }, api);
}

export async function triggerRouteAndStops(page: Page, lineId: number): Promise<void> {
  const api = scraperConfig.sakusApi;
  await page.evaluate(
    async (base, id) => {
      await fetch(`${base}/api/v1/Ulasim/route-and-busstops/${id}`);
    },
    api,
    lineId,
  );
}

export async function triggerVehiclePoll(page: Page, asisId: number): Promise<void> {
  const api = scraperConfig.sakusApi;
  await page.evaluate(
    async (base, id) => {
      await fetch(`${base}/api/v1/VehicleTracking?AsisId=${id}`);
    },
    api,
    asisId,
  );
}

export async function triggerAllVehicles(page: Page): Promise<void> {
  const api = scraperConfig.sakusApi;
  await page.evaluate(async (base) => {
    await fetch(`${base}/api/v1/VehicleTracking`);
  }, api);
}

export async function collectLineList(page: Page): Promise<SakusLineListItem[]> {
  const byId = new Map<number, SakusLineListItem>();
  const pending: Promise<void>[] = [];

  const onRes = (res: HTTPResponse) => {
    if (!isLineListUrl(res.url()) || !res.ok()) return;
    pending.push(
      (async () => {
        const data = await readJson<SakusLineListItem[]>(res);
        if (!Array.isArray(data)) return;
        for (const line of data) {
          if (!line || typeof line.id !== "number" || !line.slug) continue;
          byId.set(line.id, line);
        }
      })(),
    );
  };

  page.on("response", onRes);
  try {
    await page.goto(`${scraperConfig.sakusBase}/harita`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await triggerLineLists(page);
    const deadline = Date.now() + 20_000;
    while (byId.size < 10 && Date.now() < deadline) {
      await Promise.all(pending);
      await new Promise((r) => setTimeout(r, 300));
    }
    await Promise.all(pending);
  } finally {
    page.off("response", onRes);
  }

  return [...byId.values()].sort((a, b) =>
    String(a.lineNumber ?? a.slug).localeCompare(String(b.lineNumber ?? b.slug), "tr"),
  );
}

export async function collectRouteAndStops(
  page: Page,
  lineId: number,
  slug: string,
): Promise<SakusRouteAndStops> {
  const url = `${scraperConfig.sakusBase}/harita?hat=${encodeURIComponent(slug)}`;
  const wait = page.waitForResponse(
    (r) => isRouteStopsUrl(r.url()) && r.url().includes(`/route-and-busstops/${lineId}`) && r.ok(),
    { timeout: 40_000 },
  );
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  let res: HTTPResponse;
  try {
    res = await wait;
  } catch {
    const retry = page.waitForResponse(
      (r) => isRouteStopsUrl(r.url()) && r.url().includes(`/route-and-busstops/${lineId}`) && r.ok(),
      { timeout: 25_000 },
    );
    await triggerRouteAndStops(page, lineId);
    res = await retry;
  }
  const data = await readJson<SakusRouteAndStops>(res);
  if (!data?.lineId) {
    throw new Error(`route-and-busstops boş: lineId=${lineId} slug=${slug}`);
  }
  return data;
}

export async function collectLineSchedules(page: Page, lineId: number): Promise<ScheduleDayPayload[]> {
  const dates = scheduleQueryDates();
  const api = scraperConfig.sakusApi;
  const rows = await page.evaluate(
    async (base, id, days) => {
      const out: { gunKod: string; date: string; data: unknown | null }[] = [];
      for (const d of days) {
        try {
          const r = await fetch(
            `${base}/api/v1/Ulasim/line-schedule?date=${encodeURIComponent(d.date)}&lineId=${id}`,
          );
          out.push({ gunKod: d.gunKod, date: d.date, data: r.ok ? await r.json() : null });
        } catch {
          out.push({ gunKod: d.gunKod, date: d.date, data: null });
        }
      }
      return out;
    },
    api,
    lineId,
    dates,
  );
  return rows.map((row) => ({
    gunKod: row.gunKod as ScheduleDayPayload["gunKod"],
    date: row.date,
    data: (row.data as SakusLineSchedule | null) ?? null,
  }));
}
