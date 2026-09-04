import type { RowDataPacket } from "mysql2";
import { exec, query } from "./db.js";

export type SohbetRol = "user" | "assistant" | "system" | "tool";

export type PublicMesaj = {
  id: number;
  rol: SohbetRol;
  icerik: string;
  created_at: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSessionId(v: string): boolean {
  return UUID_RE.test(v.trim());
}

export function asMeta(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function parseHostOrigin(raw?: string | null, headerOrigin?: string | null, referer?: string | null): string | null {
  const s = (raw || headerOrigin || referer || "").trim();
  if (!s) return null;
  try {
    return new URL(s).origin.slice(0, 255);
  } catch {
    return s.slice(0, 255);
  }
}

export async function ensureOturum(opts: {
  sessionId: string;
  kaynak: string;
  origin?: { lat: number; lng: number };
  webchatId: number | null;
  agentId: number | null;
  hostOrigin: string | null;
}): Promise<void> {
  await exec(
    `INSERT INTO sohbet_oturumlari (id, kaynak, origin_lat, origin_lng, webchat_id, agent_id, host_origin)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       origin_lat = COALESCE(VALUES(origin_lat), origin_lat),
       origin_lng = COALESCE(VALUES(origin_lng), origin_lng),
       webchat_id = COALESCE(webchat_id, VALUES(webchat_id)),
       agent_id = COALESCE(VALUES(agent_id), agent_id),
       host_origin = COALESCE(host_origin, VALUES(host_origin)),
       updated_at = CURRENT_TIMESTAMP`,
    [
      opts.sessionId,
      opts.kaynak,
      opts.origin?.lat ?? null,
      opts.origin?.lng ?? null,
      opts.webchatId,
      opts.agentId,
      opts.hostOrigin,
    ],
  );
}

export async function oturumKonumu(sessionId: string): Promise<{ lat: number; lng: number } | undefined> {
  const rows = await query<RowDataPacket[]>(
    `SELECT origin_lat, origin_lng FROM sohbet_oturumlari WHERE id = ? LIMIT 1`,
    [sessionId],
  );
  const lat = Number(rows[0]?.origin_lat);
  const lng = Number(rows[0]?.origin_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat === 0 && lng === 0) return undefined;
  return { lat, lng };
}

export async function touchOturum(sessionId: string, agentId: number | null): Promise<void> {
  await exec(
    `UPDATE sohbet_oturumlari SET agent_id = COALESCE(?, agent_id), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [agentId, sessionId],
  );
}

export async function insertMesaj(
  oturumId: string,
  rol: SohbetRol,
  icerik: string,
  meta?: Record<string, unknown> | null,
): Promise<number> {
  const toolAd = typeof meta?.tool_ad === "string" ? meta.tool_ad : null;
  const fnKod = typeof meta?.fonksiyon_kod === "string" ? meta.fonksiyon_kod : null;
  const res = await exec(
    `INSERT INTO sohbet_mesajlari (oturum_id, rol, icerik, meta_json, tool_ad, fonksiyon_kod)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [oturumId, rol, icerik, meta ? JSON.stringify(meta) : null, toolAd, fnKod],
  );
  return Number(res.insertId);
}

export async function logSohbetOlay(
  oturumId: string,
  fonksiyonKod: string,
  input: Record<string, unknown>,
  ok: boolean,
  sureMs: number,
  toolAd?: string | null,
): Promise<void> {
  try {
    await exec(
      `INSERT INTO kullanici_olaylari (oturum_id, tool_ad, fonksiyon_kod, input_json, ok, sure_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [oturumId, toolAd ?? null, fonksiyonKod, JSON.stringify(input), ok ? 1 : 0, sureMs],
    );
  } catch {
    /* migrate henüz olmamış olabilir */
  }
}

const PUBLIC_MSG_SQL = `SELECT id, rol, icerik, created_at
  FROM sohbet_mesajlari
  WHERE oturum_id = ?
    AND rol IN ('user', 'assistant')
    AND CHAR_LENGTH(TRIM(icerik)) > 0
  ORDER BY id`;

export async function listPublicMesajlar(sessionId: string): Promise<PublicMesaj[]> {
  const rows = await query<RowDataPacket[]>(PUBLIC_MSG_SQL, [sessionId]);
  return rows.map((r) => ({
    id: Number(r.id),
    rol: r.rol as SohbetRol,
    icerik: String(r.icerik),
    created_at: String(r.created_at),
  }));
}

export async function listLlmGecmisi(sessionId: string, limit = 40): Promise<RowDataPacket[]> {
  const n = Math.min(80, Math.max(1, Math.floor(limit)));
  const rows = await query<RowDataPacket[]>(
    `SELECT rol, icerik, meta_json FROM sohbet_mesajlari WHERE oturum_id = ? ORDER BY id DESC LIMIT ${n}`,
    [sessionId],
  );
  return rows.reverse();
}

export async function listOturumlar(webchatId?: number) {
  const where = webchatId != null ? "WHERE o.webchat_id = ?" : "";
  const args = webchatId != null ? [webchatId] : [];
  return query<RowDataPacket[]>(
    `SELECT o.id, o.kaynak, o.origin_lat, o.origin_lng, o.hedef_text, o.host_origin,
            o.webchat_id, o.agent_id, o.created_at, o.updated_at,
            w.ad AS webchat_ad, w.slug AS webchat_slug,
            a.ad AS agent_ad,
            (SELECT LEFT(icerik, 240) FROM sohbet_mesajlari m
              WHERE m.oturum_id = o.id AND m.rol = 'user' ORDER BY m.id DESC LIMIT 1) AS last_user,
            (SELECT LEFT(icerik, 240) FROM sohbet_mesajlari m
              WHERE m.oturum_id = o.id AND m.rol = 'assistant' AND CHAR_LENGTH(TRIM(m.icerik)) > 0
              ORDER BY m.id DESC LIMIT 1) AS last_assistant,
            (SELECT COUNT(*) FROM sohbet_mesajlari m
              WHERE m.oturum_id = o.id AND m.rol IN ('user','assistant') AND CHAR_LENGTH(TRIM(m.icerik)) > 0
            ) AS message_count,
            (SELECT COUNT(*) FROM sohbet_mesajlari m WHERE m.oturum_id = o.id AND m.rol = 'tool') AS tool_count
     FROM sohbet_oturumlari o
     LEFT JOIN webchatler w ON w.id = o.webchat_id
     LEFT JOIN agentler a ON a.id = o.agent_id
     ${where}
     ORDER BY o.updated_at DESC
     LIMIT 200`,
    args,
  );
}

export async function getOturumDetay(id: string) {
  const oturumlar = await query<RowDataPacket[]>(
    `SELECT o.*, w.ad AS webchat_ad, w.slug AS webchat_slug, a.ad AS agent_ad,
            a.llm_saglayici, a.model
     FROM sohbet_oturumlari o
     LEFT JOIN webchatler w ON w.id = o.webchat_id
     LEFT JOIN agentler a ON a.id = o.agent_id
     WHERE o.id = ?`,
    [id],
  );
  if (!oturumlar[0]) return null;
  const mesajlar = await query<RowDataPacket[]>(
    `SELECT id, rol, icerik, meta_json, tool_ad, fonksiyon_kod, created_at
     FROM sohbet_mesajlari WHERE oturum_id = ? ORDER BY id`,
    [id],
  );
  const olaylar = await query<RowDataPacket[]>(
    `SELECT id, tool_ad, fonksiyon_kod, input_json, ok, sure_ms, created_at
     FROM kullanici_olaylari WHERE oturum_id = ? ORDER BY id`,
    [id],
  );
  return {
    oturum: oturumlar[0],
    mesajlar: mesajlar.map((m) => ({
      id: Number(m.id),
      rol: m.rol,
      icerik: m.icerik,
      meta: asMeta(m.meta_json),
      tool_ad: m.tool_ad,
      fonksiyon_kod: m.fonksiyon_kod,
      created_at: m.created_at,
    })),
    olaylar,
  };
}
