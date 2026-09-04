import type { NormalizedVehicle } from "@sakus/shared";
import { apiConfig } from "./config.js";
import { exec, query } from "./db.js";
import { genisletAramaToken } from "./yer-sozlugu.js";
import type { RowDataPacket } from "mysql2";

async function scraperRequest(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${apiConfig.scraperUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-internal-secret": apiConfig.internalSecret,
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

export async function getScraperStatus(): Promise<{ ingestRunning: boolean; live: string[]; reachable: boolean }> {
  try {
    const res = await fetch(`${apiConfig.scraperUrl}/health`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { ingestRunning: false, live: [], reachable: false };
    const data = (await res.json()) as { ingestRunning?: boolean; live?: string[] };
    return {
      ingestRunning: Boolean(data.ingestRunning),
      live: Array.isArray(data.live) ? data.live : [],
      reachable: true,
    };
  } catch {
    return { ingestRunning: false, live: [], reachable: false };
  }
}

export async function isIngestRunning(): Promise<boolean> {
  return (await getScraperStatus()).ingestRunning;
}

export async function liveSlugs(): Promise<string[]> {
  return (await getScraperStatus()).live;
}

async function createJob(kind: "all" | "hat", hatSlug: string | null): Promise<number> {
  const res = await exec(
    `INSERT INTO ingest_jobs (kind, hat_slug, status, started_at) VALUES (?, ?, 'running', NOW())`,
    [kind, hatSlug],
  );
  return res.insertId;
}

export async function markIngestProgress(jobId: number, line: string): Promise<void> {
  await exec(`UPDATE ingest_jobs SET progress_json = ? WHERE id = ?`, [
    JSON.stringify({ line: line.slice(0, 3500) }),
    jobId,
  ]);
}

export async function markIngestDone(jobId: number, ok: boolean, error?: string): Promise<void> {
  await exec(
    `UPDATE ingest_jobs SET status = ?, error_text = ?, finished_at = NOW() WHERE id = ?`,
    [ok ? "success" : "error", ok ? null : (error ?? "hata"), jobId],
  );
}

export async function startIngest(opts: {
  slug?: string;
  limit?: number;
  onLog: (line: string) => void;
}): Promise<{ jobId: number }> {
  const status = await getScraperStatus();
  if (!status.reachable) {
    throw new Error("Puppeteer konteyneri ayakta değil. `docker compose up -d --build scraper` çalıştır.");
  }
  if (status.ingestRunning) {
    throw new Error("Ingest zaten çalışıyor");
  }
  const kind = opts.slug ? "hat" : "all";
  const jobId = await createJob(kind, opts.slug ?? null);
  const res = await scraperRequest("/ingest", {
    method: "POST",
    body: JSON.stringify({ jobId, slug: opts.slug, limit: opts.limit }),
  });
  if (!res.ok && res.status !== 202) {
    const text = await res.text();
    await markIngestDone(jobId, false, text.slice(0, 1000));
    throw new Error(`Scraper ingest başlatılamadı: ${text}`);
  }
  opts.onLog(`scraper ingest job #${jobId}`);
  return { jobId };
}

export async function startLive(slug: string): Promise<void> {
  const status = await getScraperStatus();
  if (!status.reachable) {
    throw new Error("Puppeteer konteyneri ayakta değil. `docker compose up -d --build scraper` çalıştır.");
  }
  const res = await scraperRequest("/live/start", {
    method: "POST",
    body: JSON.stringify({ slug }),
  });
  if (!res.ok && res.status !== 202) {
    throw new Error(await res.text());
  }
}

export async function stopLive(slug: string): Promise<boolean> {
  const res = await scraperRequest("/live/stop", {
    method: "POST",
    body: JSON.stringify({ slug }),
  });
  return res.ok;
}

export async function upsertVehicles(vehicles: NormalizedVehicle[]): Promise<void> {
  for (const v of vehicles) {
    await exec(
      `INSERT INTO arac_son_konum (
         bus_number, hat_id, line_number, plate, lat, lng, speed, heading, status,
         route_id, route_name, next_stop_id, next_stop_name, at_stop_id, at_stop_name,
         eta_s, dist_next_stop_m, tracking_id, start_location, end_location, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         hat_id = VALUES(hat_id),
         line_number = VALUES(line_number),
         plate = VALUES(plate),
         lat = VALUES(lat),
         lng = VALUES(lng),
         speed = VALUES(speed),
         heading = VALUES(heading),
         status = VALUES(status),
         route_id = VALUES(route_id),
         route_name = VALUES(route_name),
         next_stop_id = VALUES(next_stop_id),
         next_stop_name = VALUES(next_stop_name),
         at_stop_id = VALUES(at_stop_id),
         at_stop_name = VALUES(at_stop_name),
         eta_s = VALUES(eta_s),
         dist_next_stop_m = VALUES(dist_next_stop_m),
         tracking_id = VALUES(tracking_id),
         start_location = VALUES(start_location),
         end_location = VALUES(end_location),
         updated_at = VALUES(updated_at)`,
      [
        v.busNumber,
        v.hatId,
        v.lineNumber,
        v.plate,
        v.lat,
        v.lng,
        v.speed,
        v.heading,
        v.status,
        v.routeId,
        v.routeName,
        v.nextStopId,
        v.nextStopName,
        v.atStopId,
        v.atStopName,
        v.etaS,
        v.distNextStopM,
        v.trackingId,
        v.startLocation,
        v.endLocation,
        new Date(v.updatedAt),
      ],
    );
  }
}

export type HatRow = RowDataPacket & {
  id: number;
  kod: string;
  slug: string;
  ad: string;
  bus_type_name: string | null;
  bus_type_color: string | null;
  asis_id: number | null;
  last_ingested_at: Date | null;
};

/** "Sakaryapark Küpçüler" → SAKARYAPARK - KÜPÇÜLER gibi tireli adları da tutar. */
export function hatSearchClause(q: string, alias = ""): { sql: string; params: string[] } {
  const col = (name: string) => (alias ? `${alias}.${name}` : name);
  const tokens = q
    .split(/[\s,./_|-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 5);
  const parts = tokens.length ? tokens : [q.trim()].filter(Boolean);
  const clauses: string[] = [];
  const params: string[] = [];
  for (const t of parts) {
    const terimler = genisletAramaToken(t);
    const orlar = terimler.map(() => `(${col("kod")} LIKE ? OR ${col("ad")} LIKE ? OR ${col("slug")} LIKE ?)`);
    clauses.push(orlar.length > 1 ? `(${orlar.join(" OR ")})` : orlar[0]!);
    for (const terim of terimler) {
      const like = `%${terim}%`;
      params.push(like, like, like);
    }
  }
  return { sql: clauses.join(" AND ") || "1=0", params };
}

export async function listHatlar(q?: string): Promise<HatRow[]> {
  if (q) {
    const { sql, params } = hatSearchClause(q);
    return query<HatRow[]>(
      `SELECT id, kod, slug, ad, bus_type_name, bus_type_color, asis_id, last_ingested_at
       FROM hatlar
       WHERE ${sql}
       ORDER BY kod`,
      params,
    );
  }
  return query<HatRow[]>(
    `SELECT id, kod, slug, ad, bus_type_name, bus_type_color, asis_id, last_ingested_at
     FROM hatlar ORDER BY kod`,
  );
}

export async function getHatBySlug(slug: string): Promise<HatRow | undefined> {
  const rows = await query<HatRow[]>(
    `SELECT id, kod, slug, ad, bus_type_name, bus_type_color, asis_id, last_ingested_at
     FROM hatlar WHERE slug = ? OR kod = ? LIMIT 1`,
    [slug, slug],
  );
  return rows[0];
}

export type HatOzet = {
  hat: number;
  durak: number;
  guzergah: number;
  turler: { ad: string; n: number; renk: string | null }[];
  sonGuncelleme: string | null;
  bugunCekilen: number;
  eskiHat: number;
  arac: number;
  tazeArac: number;
  aracliHat: number;
};

function n(row: RowDataPacket | undefined, key: string): number {
  return Number(row?.[key] ?? 0);
}

export async function hatOzet(): Promise<HatOzet> {
  const [hat] = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM hatlar`);
  const [durak] = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM duraklar`);
  const [guzergah] = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM hat_guzergah`);
  const turler = await query<RowDataPacket[]>(
    `SELECT COALESCE(NULLIF(bus_type_name, ''), 'Diğer') AS ad,
            MAX(bus_type_color) AS renk,
            COUNT(*) AS n
     FROM hatlar
     GROUP BY COALESCE(NULLIF(bus_type_name, ''), 'Diğer')
     ORDER BY n DESC
     LIMIT 6`,
  );
  const [son] = await query<RowDataPacket[]>(`SELECT MAX(last_ingested_at) AS ts FROM hatlar`);
  const [bugun] = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM hatlar WHERE last_ingested_at >= (UTC_TIMESTAMP() - INTERVAL 1 DAY)`,
  );
  const [eski] = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM hatlar
     WHERE last_ingested_at IS NULL OR last_ingested_at < (UTC_TIMESTAMP() - INTERVAL 7 DAY)`,
  );
  const [arac] = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM arac_son_konum`);
  const [taze] = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM arac_son_konum
     WHERE updated_at >= (UTC_TIMESTAMP(3) - INTERVAL 90 SECOND)`,
  );
  const [aracli] = await query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT hat_id) AS n FROM arac_son_konum`,
  );
  const sonTs = son?.ts instanceof Date ? son.ts.toISOString() : son?.ts ? String(son.ts) : null;
  return {
    hat: n(hat, "n"),
    durak: n(durak, "n"),
    guzergah: n(guzergah, "n"),
    turler: turler.map((t) => ({
      ad: String(t.ad),
      n: n(t, "n"),
      renk: t.renk ? String(t.renk) : null,
    })),
    sonGuncelleme: sonTs,
    bugunCekilen: n(bugun, "n"),
    eskiHat: n(eski, "n"),
    arac: n(arac, "n"),
    tazeArac: n(taze, "n"),
    aracliHat: n(aracli, "n"),
  };
}
