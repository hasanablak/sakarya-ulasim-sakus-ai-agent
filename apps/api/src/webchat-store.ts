import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { isEmbedKey } from "@sakus/shared";
import {
  DEFAULT_WEBCHAT_TEMA,
  mergeWebchatTema,
  type WebchatKonum,
  type WebchatPublic,
} from "@sakus/shared";
import { exec, query } from "./db.js";

const SLUG = /^[a-z][a-z0-9-]{1,62}$/;

type Body = {
  ad?: string;
  slug?: string;
  agent_id?: number | null;
  baslik?: string;
  karsilama?: string;
  placeholder?: string;
  fab_ac?: string;
  fab_kapat?: string;
  konum?: string;
  tema?: unknown;
  aktif?: boolean;
  varsayilan?: boolean;
};

function parseTemaJson(raw: unknown) {
  if (raw == null) return DEFAULT_WEBCHAT_TEMA;
  if (typeof raw === "string") {
    try {
      return mergeWebchatTema(JSON.parse(raw));
    } catch {
      return mergeWebchatTema(null);
    }
  }
  return mergeWebchatTema(raw);
}

function asPublic(row: RowDataPacket): WebchatPublic {
  const konum: WebchatKonum = row.konum === "sol_alt" ? "sol_alt" : "sag_alt";
  return {
    id: Number(row.id),
    embed_key: String(row.embed_key),
    slug: String(row.slug),
    ad: String(row.ad),
    agent_id: row.agent_id != null ? Number(row.agent_id) : null,
    agent_ad: row.agent_ad != null ? String(row.agent_ad) : null,
    baslik: String(row.baslik || "SAKUS sohbet"),
    karsilama: String(row.karsilama || ""),
    placeholder: String(row.placeholder || "Mesaj yaz…"),
    fab_ac: String(row.fab_ac || "Sohbet"),
    fab_kapat: String(row.fab_kapat || "Kapat"),
    konum,
    tema: parseTemaJson(row.tema_json),
    aktif: Boolean(row.aktif),
    varsayilan: Boolean(row.varsayilan),
  };
}

const SELECT = `SELECT w.id, w.embed_key, w.ad, w.slug, w.agent_id, a.ad AS agent_ad, w.baslik, w.karsilama,
       w.placeholder, w.fab_ac, w.fab_kapat, w.konum, w.tema_json, w.aktif, w.varsayilan,
       w.created_at, w.updated_at
     FROM webchatler w
     LEFT JOIN agentler a ON a.id = w.agent_id`;

async function agentVar(id: number): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(`SELECT id FROM agentler WHERE id = ?`, [id]);
  return Boolean(rows[0]);
}

async function parseAgentId(raw: unknown): Promise<number | null> {
  if (raw == null || raw === "" || raw === 0) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new Error("geçersiz agent");
  if (!(await agentVar(id))) throw new Error("agent bulunamadı");
  return id;
}

function parseKonum(raw: unknown, fb: WebchatKonum): WebchatKonum {
  return raw === "sol_alt" || raw === "sag_alt" ? raw : fb;
}

async function setVarsayilan(id: number): Promise<void> {
  await exec(`UPDATE webchatler SET varsayilan = 0 WHERE id <> ?`, [id]);
  await exec(`UPDATE webchatler SET varsayilan = 1 WHERE id = ?`, [id]);
}

export async function seedDefaultWebchat(): Promise<void> {
  const n = await query<RowDataPacket[]>(`SELECT COUNT(*) AS c FROM webchatler`);
  if (Number(n[0]?.c) > 0) return;
  const agents = await query<RowDataPacket[]>(`SELECT id FROM agentler WHERE aktif = 1 ORDER BY id LIMIT 1`);
  const agentId = agents[0] ? Number(agents[0].id) : null;
  await exec(
    `INSERT INTO webchatler (ad, slug, agent_id, baslik, karsilama, placeholder, fab_ac, fab_kapat, konum, tema_json, embed_key, aktif, varsayilan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
    [
      "Ana site",
      "public",
      agentId,
      "SAKUS sohbet",
      "Hat kodu yaz (ör. A1) veya “nasıl çalışır?” diye sor.",
      "Mesaj yaz…",
      "Sohbet",
      "Kapat",
      "sag_alt",
      JSON.stringify(DEFAULT_WEBCHAT_TEMA),
      randomUUID(),
    ],
  );
}

export async function listWebchatler(): Promise<WebchatPublic[]> {
  const rows = await query<RowDataPacket[]>(`${SELECT} ORDER BY w.varsayilan DESC, w.id DESC`);
  return rows.map(asPublic);
}

export async function getWebchat(id: number): Promise<WebchatPublic | null> {
  const rows = await query<RowDataPacket[]>(`${SELECT} WHERE w.id = ?`, [id]);
  return rows[0] ? asPublic(rows[0]) : null;
}

export async function getWebchatBySlug(slug: string, onlyAktif = false): Promise<WebchatPublic | null> {
  const rows = await query<RowDataPacket[]>(
    `${SELECT} WHERE w.slug = ? ${onlyAktif ? "AND w.aktif = 1" : ""}`,
    [slug],
  );
  return rows[0] ? asPublic(rows[0]) : null;
}

export async function getPublicWebchat(ref?: string): Promise<WebchatPublic | null> {
  if (ref) {
    const val = ref.trim();
    const rows = isEmbedKey(val)
      ? await query<RowDataPacket[]>(`${SELECT} WHERE w.embed_key = ? AND w.aktif = 1`, [val])
      : await query<RowDataPacket[]>(`${SELECT} WHERE w.slug = ? AND w.aktif = 1`, [val]);
    return rows[0] ? asPublic(rows[0]) : null;
  }
  const def = await query<RowDataPacket[]>(`${SELECT} WHERE w.varsayilan = 1 AND w.aktif = 1 LIMIT 1`);
  if (def[0]) return asPublic(def[0]);
  const any = await query<RowDataPacket[]>(`${SELECT} WHERE w.aktif = 1 ORDER BY w.id LIMIT 1`);
  return any[0] ? asPublic(any[0]) : null;
}

export async function createWebchat(body: Body): Promise<WebchatPublic> {
  const ad = (body.ad ?? "").trim();
  const slug = (body.slug ?? "").trim();
  if (!ad) throw new Error("webchat adı gerekli");
  if (!SLUG.test(slug)) throw new Error("slug küçük harf, rakam ve tire olmalı (ör. public)");
  const agentId = await parseAgentId(body.agent_id);
  const tema = mergeWebchatTema(body.tema);
  const konum = parseKonum(body.konum, "sag_alt");
  const existing = await query<RowDataPacket[]>(`SELECT COUNT(*) AS c FROM webchatler`);
  const first = Number(existing[0]?.c) === 0;
  const varsayilan = body.varsayilan === true || first ? 1 : 0;
  const embedKey = randomUUID();
  const res = await exec(
    `INSERT INTO webchatler (ad, slug, agent_id, baslik, karsilama, placeholder, fab_ac, fab_kapat, konum, tema_json, embed_key, aktif, varsayilan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ad,
      slug,
      agentId,
      (body.baslik ?? "").trim() || "SAKUS sohbet",
      (body.karsilama ?? "").trim() || null,
      (body.placeholder ?? "").trim() || "Mesaj yaz…",
      (body.fab_ac ?? "").trim() || "Sohbet",
      (body.fab_kapat ?? "").trim() || "Kapat",
      konum,
      JSON.stringify(tema),
      embedKey,
      body.aktif === false ? 0 : 1,
      varsayilan,
    ],
  );
  if (varsayilan) await setVarsayilan(res.insertId);
  const created = await getWebchat(res.insertId);
  if (!created) throw new Error("webchat oluşturulamadı");
  return created;
}

export async function updateWebchat(id: number, body: Body): Promise<WebchatPublic | null> {
  const cur = await getWebchat(id);
  if (!cur) return null;
  const ad = (body.ad ?? cur.ad).trim();
  const slug = (body.slug ?? cur.slug).trim();
  if (!ad) throw new Error("webchat adı gerekli");
  if (!SLUG.test(slug)) throw new Error("slug küçük harf, rakam ve tire olmalı");
  const agentId = body.agent_id === undefined ? cur.agent_id : await parseAgentId(body.agent_id);
  const tema = mergeWebchatTema(body.tema ?? cur.tema);
  const konum = parseKonum(body.konum, cur.konum);
  const aktif = body.aktif === undefined ? (cur.aktif ? 1 : 0) : body.aktif ? 1 : 0;
  await exec(
    `UPDATE webchatler SET ad = ?, slug = ?, agent_id = ?, baslik = ?, karsilama = ?, placeholder = ?,
       fab_ac = ?, fab_kapat = ?, konum = ?, tema_json = ?, aktif = ?
     WHERE id = ?`,
    [
      ad,
      slug,
      agentId,
      (body.baslik ?? cur.baslik).trim() || "SAKUS sohbet",
      (body.karsilama ?? cur.karsilama).trim() || null,
      (body.placeholder ?? cur.placeholder).trim() || "Mesaj yaz…",
      (body.fab_ac ?? cur.fab_ac).trim() || "Sohbet",
      (body.fab_kapat ?? cur.fab_kapat).trim() || "Kapat",
      konum,
      JSON.stringify(tema),
      aktif,
      id,
    ],
  );
  if (body.varsayilan === true) await setVarsayilan(id);
  else if (body.varsayilan === false && cur.varsayilan) {
    await exec(`UPDATE webchatler SET varsayilan = 0 WHERE id = ?`, [id]);
    const next = await query<RowDataPacket[]>(
      `SELECT id FROM webchatler WHERE id <> ? AND aktif = 1 ORDER BY id LIMIT 1`,
      [id],
    );
    if (next[0]) await setVarsayilan(Number(next[0].id));
  }
  return getWebchat(id);
}

export async function deleteWebchat(id: number): Promise<boolean> {
  const cur = await getWebchat(id);
  if (!cur) return false;
  const res = await exec(`DELETE FROM webchatler WHERE id = ?`, [id]);
  if (res.affectedRows === 0) return false;
  if (cur.varsayilan) {
    const next = await query<RowDataPacket[]>(`SELECT id FROM webchatler WHERE aktif = 1 ORDER BY id LIMIT 1`);
    if (next[0]) await setVarsayilan(Number(next[0].id));
  }
  return true;
}
