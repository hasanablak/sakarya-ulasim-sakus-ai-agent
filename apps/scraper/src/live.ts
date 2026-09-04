import { io } from "socket.io-client";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  EVENTS,
  INTERNAL_NS,
  lineIdFromSlug,
  normalizeVehicle,
  type AracKonumPayload,
} from "@sakus/shared";
import { launchBrowser, openSakusPage } from "./browser.js";
import { argValue, scraperConfig, sleep } from "./config.js";
import { attachVehicleListener, triggerAllVehicles, triggerVehiclePoll } from "./intercept.js";

function log(obj: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj }));
}

async function lookupHat(slug: string): Promise<{
  slug: string;
  id: number;
  asisId: number | null;
}> {
  const res = await fetch(
    `${scraperConfig.apiPublic}/api/internal/hat/${encodeURIComponent(slug)}`,
    { headers: { "x-internal-secret": scraperConfig.internalSecret } },
  );
  if (res.ok) {
    const data = (await res.json()) as { id: number; slug: string; asisId: number | null };
    return { slug: data.slug, id: data.id, asisId: data.asisId };
  }
  const id = lineIdFromSlug(slug);
  if (!id) throw new Error(`Hat API'de yok ve slug'dan id okunamadı: ${slug}`);
  return { slug, id, asisId: null };
}

export async function runLive(slug: string, signal?: AbortSignal): Promise<void> {
  const hat = await lookupHat(slug);
  let asisId = hat.asisId;
  const socket = io(`${scraperConfig.apiPublic}${INTERNAL_NS}`, {
    extraHeaders: { "x-internal-secret": scraperConfig.internalSecret },
    transports: ["websocket"],
  });

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", (e) => reject(e));
    setTimeout(() => reject(new Error("iç socket zaman aşımı")), 10_000);
  });

  const browser = await launchBrowser();
  const page = await openSakusPage(browser);
  let lastEmit = 0;

  const emit = (vehiclesRaw: Parameters<typeof normalizeVehicle>[0][], source: AracKonumPayload["source"]) => {
    const vehicles = vehiclesRaw
      .filter((v) => v.lineId === hat.id)
      .map(normalizeVehicle)
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const nhat = vehiclesRaw.find((v) => v.lineId === hat.id)?.nhatNo;
    if (nhat && !asisId) asisId = nhat;
    if (!vehicles.length) return;
    lastEmit = Date.now();
    const payload: AracKonumPayload = {
      hatSlug: hat.slug,
      hatId: hat.id,
      vehicles,
      source,
    };
    socket.emit(EVENTS.aracKonum, payload);
    log({ type: "emit", source, count: vehicles.length, slug: hat.slug });
  };

  const detach = attachVehicleListener(page, (vehicles, _url, source) => {
    emit(vehicles, source);
  });

  const onAbort = () => {
    /* loop checks signal */
  };
  signal?.addEventListener("abort", onAbort);

  try {
    log({ type: "live.start", slug: hat.slug, hatId: hat.id, asisId });
    socket.emit(EVENTS.scraperHealth, { kind: "live", slug: hat.slug, status: "running" });

    await page.goto(`${scraperConfig.sakusBase}/harita?hat=${encodeURIComponent(hat.slug)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await sleep(2500);
    if (Date.now() - lastEmit > 8_000) {
      if (asisId) await triggerVehiclePoll(page, asisId);
      else await triggerAllVehicles(page);
    }

    while (!signal?.aborted) {
      if (Date.now() - lastEmit > 8_000) {
        try {
          if (asisId) await triggerVehiclePoll(page, asisId);
          else await triggerAllVehicles(page);
        } catch (e) {
          log({ type: "poll.error", message: String(e) });
        }
      }
      socket.emit(EVENTS.scraperHealth, { kind: "live", slug: hat.slug, status: "running" });
      await sleep(4_000);
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    detach();
    socket.emit(EVENTS.scraperHealth, { kind: "live", slug: hat.slug, status: "stopped" });
    socket.close();
    await browser.close();
  }
}

const isCli = Boolean(
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]),
);
if (isCli) {
  const slug = argValue("--slug");
  if (!slug) {
    console.error("Kullanım: npm run live -- --slug a1-adaray-51");
    process.exit(1);
  }
  runLive(slug).catch((err) => {
    console.error(JSON.stringify({ type: "error", message: String(err?.message ?? err) }));
    process.exit(1);
  });
}
