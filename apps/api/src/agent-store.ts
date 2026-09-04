import type { RowDataPacket } from "mysql2";
import { LLM_SAGLAYICILAR } from "@sakus/shared";
import { exec, query } from "./db.js";
import { FONKSIYONLAR, fonksiyonVar } from "./tool-functions.js";

const TOOL_AD = /^[a-z][a-z0-9_]{1,63}$/;

function parseSaglayici(raw: string | undefined, fallback = "openai"): string {
  const sag = (raw ?? fallback).trim().toLowerCase() || fallback;
  if (!LLM_SAGLAYICILAR.some((s) => s.id === sag)) {
    throw new Error("LLM OpenAI, Claude, Gemini veya Groq olmalı");
  }
  return sag;
}

function maskToken(token: string | null): { has_token: boolean; token_son: string | null } {
  if (!token) return { has_token: false, token_son: null };
  const t = token.trim();
  if (!t) return { has_token: false, token_son: null };
  return { has_token: true, token_son: t.length <= 4 ? "••••" : t.slice(-4) };
}

export async function seedDefaultTools(): Promise<void> {
  for (const fn of FONKSIYONLAR) {
    await exec(
      `INSERT INTO toollar (ad, aciklama, fonksiyon_kod, aktif)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE ad = ad`,
      [fn.kod, fn.aciklama, fn.kod],
    );
  }
}

export async function listToollar() {
  return query<RowDataPacket[]>(
    `SELECT id, ad, aciklama, fonksiyon_kod, aktif, created_at, updated_at
     FROM toollar ORDER BY ad`,
  );
}

export async function getTool(id: number) {
  const rows = await query<RowDataPacket[]>(
    `SELECT id, ad, aciklama, fonksiyon_kod, aktif, created_at, updated_at FROM toollar WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createTool(body: { ad?: string; aciklama?: string; fonksiyon_kod?: string; aktif?: boolean }) {
  const ad = (body.ad ?? "").trim();
  const aciklama = (body.aciklama ?? "").trim();
  const fonksiyon_kod = (body.fonksiyon_kod ?? "").trim();
  if (!TOOL_AD.test(ad)) throw new Error("tool adı snake_case olmalı (ör. otobus_saat_sorgula)");
  if (!aciklama) throw new Error("açıklama gerekli");
  if (!fonksiyonVar(fonksiyon_kod)) throw new Error("geçersiz fonksiyon");
  const res = await exec(
    `INSERT INTO toollar (ad, aciklama, fonksiyon_kod, aktif) VALUES (?, ?, ?, ?)`,
    [ad, aciklama, fonksiyon_kod, body.aktif === false ? 0 : 1],
  );
  return getTool(res.insertId);
}

export async function updateTool(
  id: number,
  body: { ad?: string; aciklama?: string; fonksiyon_kod?: string; aktif?: boolean },
) {
  const cur = await getTool(id);
  if (!cur) return null;
  const ad = (body.ad ?? cur.ad).trim();
  const aciklama = (body.aciklama ?? cur.aciklama).trim();
  const fonksiyon_kod = (body.fonksiyon_kod ?? cur.fonksiyon_kod).trim();
  if (!TOOL_AD.test(ad)) throw new Error("tool adı snake_case olmalı");
  if (!aciklama) throw new Error("açıklama gerekli");
  if (!fonksiyonVar(fonksiyon_kod)) throw new Error("geçersiz fonksiyon");
  const aktif = body.aktif === undefined ? Number(cur.aktif) : body.aktif ? 1 : 0;
  await exec(`UPDATE toollar SET ad = ?, aciklama = ?, fonksiyon_kod = ?, aktif = ? WHERE id = ?`, [
    ad,
    aciklama,
    fonksiyon_kod,
    aktif,
    id,
  ]);
  return getTool(id);
}

export async function deleteTool(id: number): Promise<boolean> {
  const res = await exec(`DELETE FROM toollar WHERE id = ?`, [id]);
  return res.affectedRows > 0;
}

function publicAgent(row: RowDataPacket, toolIds: number[]) {
  const mask = maskToken(row.api_token as string | null);
  return {
    id: row.id,
    ad: row.ad,
    aciklama: row.aciklama,
    sistem_prompt: row.sistem_prompt,
    llm_saglayici: row.llm_saglayici,
    model: row.model,
    aktif: Boolean(row.aktif),
    has_token: mask.has_token,
    token_son: mask.token_son,
    tool_ids: toolIds,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function toolIdsFor(agentId: number): Promise<number[]> {
  const rows = await query<RowDataPacket[]>(`SELECT tool_id FROM agent_toollar WHERE agent_id = ?`, [agentId]);
  return rows.map((r) => Number(r.tool_id));
}

export async function listAgentler() {
  const rows = await query<RowDataPacket[]>(
    `SELECT id, ad, aciklama, sistem_prompt, llm_saglayici, model, api_token, aktif, created_at, updated_at
     FROM agentler ORDER BY id DESC`,
  );
  const out = [];
  for (const r of rows) out.push(publicAgent(r, await toolIdsFor(Number(r.id))));
  return out;
}

export async function getAgent(id: number) {
  const rows = await query<RowDataPacket[]>(`SELECT * FROM agentler WHERE id = ?`, [id]);
  if (!rows[0]) return null;
  return publicAgent(rows[0], await toolIdsFor(id));
}

export type AgentChatTool = {
  id: number;
  ad: string;
  aciklama: string;
  fonksiyon_kod: string;
};

export type AgentForChat = {
  id: number;
  ad: string;
  sistem_prompt: string;
  llm_saglayici: string;
  model: string;
  api_token: string | null;
  aktif: boolean;
  tools: AgentChatTool[];
};

/** İç sohbet döngüsü — token admin yanıtına asla konmaz. */
export async function getAgentForChat(id: number): Promise<AgentForChat | null> {
  const rows = await query<RowDataPacket[]>(`SELECT * FROM agentler WHERE id = ?`, [id]);
  const row = rows[0];
  if (!row) return null;
  const tools = await query<RowDataPacket[]>(
    `SELECT t.id, t.ad, t.aciklama, t.fonksiyon_kod
     FROM toollar t
     JOIN agent_toollar at ON at.tool_id = t.id
     WHERE at.agent_id = ? AND t.aktif = 1
     ORDER BY t.ad`,
    [id],
  );
  const token = row.api_token != null ? String(row.api_token).trim() : "";
  return {
    id: Number(row.id),
    ad: String(row.ad),
    sistem_prompt: String(row.sistem_prompt),
    llm_saglayici: String(row.llm_saglayici),
    model: String(row.model),
    api_token: token || null,
    aktif: Boolean(row.aktif),
    tools: tools.map((t) => ({
      id: Number(t.id),
      ad: String(t.ad),
      aciklama: String(t.aciklama),
      fonksiyon_kod: String(t.fonksiyon_kod),
    })),
  };
}

async function setAgentTools(agentId: number, toolIds: number[]): Promise<void> {
  await exec(`DELETE FROM agent_toollar WHERE agent_id = ?`, [agentId]);
  const uniq = [...new Set(toolIds.filter((n) => Number.isInteger(n) && n > 0))];
  for (const toolId of uniq) {
    await exec(`INSERT IGNORE INTO agent_toollar (agent_id, tool_id) VALUES (?, ?)`, [agentId, toolId]);
  }
}

export async function createAgent(body: {
  ad?: string;
  aciklama?: string;
  sistem_prompt?: string;
  llm_saglayici?: string;
  model?: string;
  api_token?: string;
  aktif?: boolean;
  tool_ids?: number[];
}) {
  const ad = (body.ad ?? "").trim();
  const sistem_prompt = (body.sistem_prompt ?? "").trim();
  if (!ad) throw new Error("agent adı gerekli");
  if (!sistem_prompt) throw new Error("sistem prompt gerekli");
  const sag = parseSaglayici(body.llm_saglayici);
  const model = (body.model ?? "gpt-4o-mini").trim() || "gpt-4o-mini";
  const token = (body.api_token ?? "").trim() || null;
  const res = await exec(
    `INSERT INTO agentler (ad, aciklama, sistem_prompt, llm_saglayici, model, api_token, aktif)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ad, (body.aciklama ?? "").trim() || null, sistem_prompt, sag, model, token, body.aktif === false ? 0 : 1],
  );
  await setAgentTools(res.insertId, body.tool_ids ?? []);
  return getAgent(res.insertId);
}

export async function updateAgent(
  id: number,
  body: {
    ad?: string;
    aciklama?: string;
    sistem_prompt?: string;
    llm_saglayici?: string;
    model?: string;
    api_token?: string;
    aktif?: boolean;
    tool_ids?: number[];
  },
) {
  const rows = await query<RowDataPacket[]>(`SELECT * FROM agentler WHERE id = ?`, [id]);
  const cur = rows[0];
  if (!cur) return null;
  const ad = (body.ad ?? cur.ad).trim();
  const sistem_prompt = (body.sistem_prompt ?? cur.sistem_prompt).trim();
  if (!ad) throw new Error("agent adı gerekli");
  if (!sistem_prompt) throw new Error("sistem prompt gerekli");
  const tokenIn = body.api_token;
  const token =
    tokenIn === undefined || tokenIn === "" || tokenIn === "********"
      ? cur.api_token
      : tokenIn.trim();
  await exec(
    `UPDATE agentler SET ad = ?, aciklama = ?, sistem_prompt = ?, llm_saglayici = ?, model = ?, api_token = ?, aktif = ?
     WHERE id = ?`,
    [
      ad,
      (body.aciklama ?? cur.aciklama ?? "").trim() || null,
      sistem_prompt,
      parseSaglayici(body.llm_saglayici ?? String(cur.llm_saglayici)),
      (body.model ?? cur.model).trim(),
      token,
      body.aktif === undefined ? Number(cur.aktif) : body.aktif ? 1 : 0,
      id,
    ],
  );
  if (body.tool_ids !== undefined) await setAgentTools(id, body.tool_ids);
  return getAgent(id);
}

export async function deleteAgent(id: number): Promise<boolean> {
  const res = await exec(`DELETE FROM agentler WHERE id = ?`, [id]);
  return res.affectedRows > 0;
}
