import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RowDataPacket } from "mysql2";
import type { AracKonumPayload, SakusLineListItem, SakusRouteAndStops, ScheduleDayPayload } from "@sakus/shared";
import { apiConfig } from "./config.js";
import { query } from "./db.js";
import { upsertHatIngest } from "./ingest-store.js";
import {
  getHatBySlug,
  getScraperStatus,
  hatOzet,
  listHatlar,
  markIngestDone,
  markIngestProgress,
  startIngest,
  startLive,
  stopLive,
} from "./jobs.js";
import { registerAgentAdminRoutes } from "./agent-routes.js";
import { registerWebchatRoutes } from "./webchat-routes.js";
import { handleChatTurn } from "./chat-engine.js";
import { getOturumDetay, listOturumlar, listPublicMesajlar } from "./chat-store.js";
import { publicIo } from "./socket.js";

const adminTokens = new Set<string>();

function internalOk(req: FastifyRequest): boolean {
  return req.headers["x-internal-secret"] === apiConfig.internalSecret;
}

function adminOk(req: FastifyRequest): boolean {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  return Boolean(token && adminTokens.has(token));
}

async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (adminOk(req)) return true;
  await reply.code(401).send({ ok: false, error: "admin yetkisi gerekli" });
  return false;
}

function staleOf(updatedAt: Date | string | null): boolean {
  if (!updatedAt) return true;
  const t = new Date(updatedAt).getTime();
  return Date.now() - t > 30_000;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({ ok: true }));

  app.post("/api/internal/ingest/line", async (req, reply) => {
    if (!internalOk(req)) return reply.code(401).send({ ok: false });
    const body = req.body as {
      line?: SakusLineListItem;
      detail?: SakusRouteAndStops;
      schedules?: ScheduleDayPayload[];
    };
    if (!body?.line || !body?.detail) return reply.code(400).send({ ok: false, error: "line+detail gerekli" });
    await upsertHatIngest(body.line, body.detail, body.schedules ?? []);
    return { ok: true, hatId: body.line.id };
  });

  app.get("/api/internal/hat/:slug", async (req, reply) => {
    if (!internalOk(req)) return reply.code(401).send({ ok: false });
    const { slug } = req.params as { slug: string };
    const hat = await getHatBySlug(slug);
    if (!hat) return reply.code(404).send({ ok: false, error: "hat yok" });
    return { id: hat.id, slug: hat.slug, asisId: hat.asis_id, kod: hat.kod };
  });

  app.post("/api/internal/ingest/progress", async (req, reply) => {
    if (!internalOk(req)) return reply.code(401).send({ ok: false });
    const body = req.body as { jobId?: number; line?: string };
    if (!body?.jobId || !body.line) return reply.code(400).send({ ok: false });
    await markIngestProgress(body.jobId, body.line);
    publicIo?.emit("hat.ingest.progress", { line: body.line });
    return { ok: true };
  });

  app.post("/api/internal/ingest/done", async (req, reply) => {
    if (!internalOk(req)) return reply.code(401).send({ ok: false });
    const body = req.body as { jobId?: number; ok?: boolean; error?: string };
    if (!body?.jobId) return reply.code(400).send({ ok: false });
    await markIngestDone(body.jobId, body.ok !== false, body.error);
    publicIo?.emit("hat.ingest.done", { jobId: body.jobId, ok: body.ok !== false });
    return { ok: true };
  });

  app.post("/api/admin/login", async (req, reply) => {
    const raw = (req.body as { password?: unknown } | null)?.password;
    const password = typeof raw === "string" ? raw.trim() : "";
    const expected = (apiConfig.adminPassword || "admin").trim();
    if (!password) {
      return reply.code(400).send({ ok: false, error: "şifre gerekli" });
    }
    if (password !== expected) {
      return reply.code(401).send({
        ok: false,
        error: "şifre hatalı — geliştirme varsayılanı: admin (MySQL şifresi sakus değil)",
      });
    }
    const token = randomUUID();
    adminTokens.add(token);
    return { ok: true, token };
  });

  app.get("/api/admin/hatlar", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const q = (req.query as { q?: string }).q;
    const rows = await listHatlar(q);
    const scraper = await getScraperStatus();
    const ozet = await hatOzet();
    const lastJobs = await query<RowDataPacket[]>(
      `SELECT id, kind, hat_slug, status, progress_json, error_text, started_at, finished_at
       FROM ingest_jobs ORDER BY id DESC LIMIT 1`,
    );
    return {
      ok: true,
      hatlar: rows,
      ingestRunning: scraper.ingestRunning,
      scraperUp: scraper.reachable,
      live: scraper.live,
      lastJob: lastJobs[0] ?? null,
      ozet,
    };
  });

  app.get("/api/admin/hatlar/:slug", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { slug } = req.params as { slug: string };
    const hat = await getHatBySlug(slug);
    if (!hat) return reply.code(404).send({ ok: false, error: "hat yok" });
    const routes = await query<RowDataPacket[]>(
      `SELECT sakus_route_id, yon_ad, start_location, end_location, route_type_id, geometry_json
       FROM hat_guzergah WHERE hat_id = ? ORDER BY sakus_route_id`,
      [hat.id],
    );
    const stops = await query<RowDataPacket[]>(
      `SELECT hd.sakus_route_id, hd.sira, d.id, d.ad, d.lat, d.lng, d.durak_no, d.akilli
       FROM hat_duraklari hd
       JOIN duraklar d ON d.id = hd.durak_id
       WHERE hd.hat_id = ?
       ORDER BY hd.sakus_route_id, hd.sira`,
      [hat.id],
    );
    const vehicles = await query<RowDataPacket[]>(
      `SELECT * FROM arac_son_konum WHERE hat_id = ? ORDER BY updated_at DESC`,
      [hat.id],
    );
    const seferler = await query<RowDataPacket[]>(
      `SELECT sakus_route_id, yon_ad, gun_kod, ornek_tarih, sefer_no, kalkis, varis, aciklama
       FROM hat_seferleri WHERE hat_id = ?
       ORDER BY FIELD(gun_kod, 'haftaici', 'cumartesi', 'pazar'), sakus_route_id, kalkis`,
      [hat.id],
    );
    return { ok: true, hat, routes, stops, vehicles, seferler };
  });

  app.post("/api/admin/ingest", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const body = (req.body as { slug?: string; limit?: number }) ?? {};
    try {
      const { jobId } = await startIngest({
        slug: body.slug,
        limit: body.limit,
        onLog: (line) => {
          publicIo?.emit("hat.ingest.progress", { line, slug: body.slug ?? null });
        },
      });
      return { ok: true, jobId };
    } catch (e) {
      return reply.code(409).send({ ok: false, error: String((e as Error).message) });
    }
  });

  app.get("/api/admin/jobs/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { id } = req.params as { id: string };
    const rows = await query<RowDataPacket[]>(`SELECT * FROM ingest_jobs WHERE id = ?`, [Number(id)]);
    if (!rows[0]) return reply.code(404).send({ ok: false });
    return { ok: true, job: rows[0] };
  });

  app.post("/api/admin/live/start", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { slug } = (req.body as { slug?: string }) ?? {};
    if (!slug) return reply.code(400).send({ ok: false, error: "slug gerekli" });
    try {
      await startLive(slug);
    } catch (e) {
      return reply.code(503).send({ ok: false, error: String((e as Error).message) });
    }
    const scraper = await getScraperStatus();
    return { ok: true, live: scraper.live };
  });

  app.post("/api/admin/live/stop", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { slug } = (req.body as { slug?: string }) ?? {};
    if (!slug) return reply.code(400).send({ ok: false, error: "slug gerekli" });
    await stopLive(slug);
    const scraper = await getScraperStatus();
    return { ok: true, live: scraper.live };
  });

  app.get("/api/admin/sohbetler", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const raw = (req.query as { webchat_id?: string }).webchat_id;
    const webchatId = raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
    const oturumlar = await listOturumlar(webchatId);
    return { ok: true, oturumlar };
  });

  app.get("/api/admin/sohbetler/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { id } = req.params as { id: string };
    const detay = await getOturumDetay(id);
    if (!detay) return reply.code(404).send({ ok: false, error: "oturum yok" });
    return { ok: true, ...detay };
  });

  registerAgentAdminRoutes(app, requireAdmin);
  registerWebchatRoutes(app, requireAdmin);

  app.get("/api/hatlar", async (req) => {
    const q = (req.query as { q?: string }).q;
    const hatlar = await listHatlar(q);
    return { ok: true, hatlar };
  });

  app.get("/api/hatlar/:slug/araclar", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const hat = await getHatBySlug(slug);
    if (!hat) return reply.code(404).send({ ok: false, error: "hat yok" });
    const vehicles = await query<RowDataPacket[]>(
      `SELECT * FROM arac_son_konum WHERE hat_id = ? ORDER BY updated_at DESC`,
      [hat.id],
    );
    const latest = vehicles[0]?.updated_at as Date | undefined;
    return { ok: true, hat, vehicles, stale: staleOf(latest ?? null) };
  });

  app.get("/api/chat/:sessionId", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const mesajlar = await listPublicMesajlar(sessionId);
    if (!mesajlar.length) {
      const oturum = await query<RowDataPacket[]>(`SELECT id FROM sohbet_oturumlari WHERE id = ?`, [sessionId]);
      if (!oturum[0]) return reply.code(404).send({ ok: false });
    }
    return { ok: true, sessionId, mesajlar };
  });

  app.post("/api/chat", async (req, reply) => {
    const body = req.body as {
      sessionId?: string;
      message?: string;
      origin?: { lat: number; lng: number };
      webchatSlug?: string;
      webchatKey?: string;
      host?: string;
      kaynak?: string;
    };
    const text = body?.message?.trim();
    if (!text) return reply.code(400).send({ ok: false, error: "mesaj boş" });
    try {
      const out = await handleChatTurn({
        sessionId: body.sessionId,
        message: text,
        origin: body.origin,
        webchatRef: body.webchatKey?.trim() || body.webchatSlug?.trim(),
        host: body.host,
        headerOrigin: typeof req.headers.origin === "string" ? req.headers.origin : undefined,
        referer: typeof req.headers.referer === "string" ? req.headers.referer : undefined,
        kaynak: body.kaynak,
      });
      return { ok: true, ...out };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return reply.code(400).send({ ok: false, error });
    }
  });
}

export type { AracKonumPayload };
