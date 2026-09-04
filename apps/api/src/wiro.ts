import { createHmac } from "node:crypto";
import { apiConfig } from "./config.js";

/** Model kartı: https://wiro.ai/models/google/gemini-3-7-flash/llms-full.txt */
export const WIRO_GEMINI_FLASH = "google/gemini-3-7-flash";
const WIRO_BASE = "https://api.wiro.ai/v1";
const RUN_PATH = `${WIRO_BASE}/Run/${WIRO_GEMINI_FLASH}`;
const SYNC_PATH = `${WIRO_BASE}/Run/${WIRO_GEMINI_FLASH}/sync`;
const DETAIL_PATH = `${WIRO_BASE}/Task/Detail`;

const TERMINAL_OK = "task_postprocess_end";
const TERMINAL_FAIL = new Set(["task_cancel", "task_error"]);
const FOREIGN_KEY = /^(sk-|sk-ant-|AIza|gsk_|cursor_)/i;

export type WiroCreds = { apiKey: string; apiSecret: string };

export function resolveWiroCreds(agentToken?: string | null): WiroCreds | null {
  const fromAgent = (agentToken ?? "").trim();
  const apiKey = (fromAgent && !FOREIGN_KEY.test(fromAgent) ? fromAgent : "") || apiConfig.wiro.apiKey;
  const apiSecret = apiConfig.wiro.apiSecret;
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

function nonce(): string {
  return String(Math.floor(Date.now() / 1000));
}

function signature(creds: WiroCreds, n: string): string {
  return createHmac("sha256", creds.apiKey)
    .update(creds.apiSecret + n)
    .digest("hex");
}

function signedHeaders(creds: WiroCreds, withSignature: boolean): Record<string, string> {
  const headers: Record<string, string> = { "x-api-key": creds.apiKey };
  if (withSignature) {
    const n = nonce();
    headers["x-nonce"] = n;
    headers["x-signature"] = signature(creds, n);
  }
  return headers;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function flattenWiroError(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (Array.isArray(raw)) return raw.map(flattenWiroError).filter(Boolean).join("; ");
  const o = asRecord(raw);
  if (!o) return "";
  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  if (o.error != null) return flattenWiroError(o.error);
  if (o.errors != null) return flattenWiroError(o.errors);
  try {
    return JSON.stringify(o).slice(0, 300);
  } catch {
    return "";
  }
}

async function wiroPost(
  url: string,
  creds: WiroCreds,
  body: Record<string, unknown>,
  timeoutMs: number,
  opts: { signed: boolean; multipart: boolean },
): Promise<{ http: number; json: Record<string, unknown> }> {
  const headers = signedHeaders(creds, opts.signed);
  let fetchBody: BodyInit;
  if (opts.multipart) {
    const form = new FormData();
    for (const [k, v] of Object.entries(body)) {
      if (v == null || v === "") continue;
      form.append(k, typeof v === "string" ? v : String(v));
    }
    fetchBody = form;
  } else {
    headers["content-type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: fetchBody,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { http: res.status, json };
}

function unwrap(json: Record<string, unknown>): Record<string, unknown> {
  return asRecord(json.data) ?? json;
}

function taskFrom(json: Record<string, unknown>): Record<string, unknown> | null {
  const list = json.tasklist;
  if (Array.isArray(list) && list[0]) return asRecord(list[0]);
  const task = asRecord(json.task);
  if (task?.status || task?.outputs || task?.debugoutput) return task;
  if (typeof json.status === "string" && (json.outputs || json.debugoutput || json.pexit)) return json;
  return null;
}

export function extractWiroAnswer(task: Record<string, unknown>): string | null {
  const outputs = task.outputs;
  if (Array.isArray(outputs)) {
    for (const raw of outputs) {
      const o = asRecord(raw);
      if (!o) continue;
      if (typeof o.content === "string" && o.content.trim()) return o.content.trim();
      if (String(o.contenttype ?? "") === "raw" || asRecord(o.content)) {
        const content = asRecord(o.content) ?? o;
        if (typeof content.raw === "string" && content.raw.trim()) return content.raw.trim();
        if (Array.isArray(content.answer)) {
          const joined = content.answer.map((x) => String(x)).join("").trim();
          if (joined) return joined;
        }
      }
      if (typeof o.url === "string" && /\.(txt|json)(\?|$)/i.test(o.url)) continue;
    }
  }
  if (typeof task.debugoutput === "string" && task.debugoutput.trim()) return task.debugoutput.trim();
  return null;
}

function taskFailed(task: Record<string, unknown>): string | null {
  const status = String(task.status ?? "");
  const errText =
    (typeof task.debugerror === "string" && task.debugerror.trim() ? task.debugerror.trim() : "") ||
    flattenWiroError(task.errors);
  if (TERMINAL_FAIL.has(status)) return errText || `Wiro görev ${status}`;
  if (status === TERMINAL_OK && String(task.pexit ?? "0") !== "0") {
    return errText || `Wiro pexit ${task.pexit}`;
  }
  return null;
}

function failMsg(http: number, json: Record<string, unknown>, label: string): string {
  return flattenWiroError(json.errors) || flattenWiroError(json) || `${label} HTTP ${http}`;
}

async function taskDetail(
  creds: WiroCreds,
  taskid: string,
  tasktoken: string | undefined,
  signed: boolean,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (tasktoken) body.tasktoken = tasktoken;
  else if (taskid) body.taskid = taskid;
  else throw new Error("Wiro Task/Detail için taskid veya tasktoken gerekli");
  const { http, json } = await wiroPost(DETAIL_PATH, creds, body, 20_000, { signed, multipart: false });
  if (http >= 400 || json.result === false) throw new Error(failMsg(http, json, "Wiro Task/Detail"));
  const task = taskFrom(json);
  if (!task) throw new Error("Wiro Task/Detail boş");
  return task;
}

async function pollDetail(
  creds: WiroCreds,
  taskid: string,
  tasktoken: string | undefined,
  signed: boolean,
  budgetMs = 55_000,
): Promise<Record<string, unknown>> {
  const t0 = Date.now();
  let delay = 1200;
  while (Date.now() - t0 < budgetMs) {
    const task = await taskDetail(creds, taskid, tasktoken, signed);
    const status = String(task.status ?? "");
    if (status === TERMINAL_OK || TERMINAL_FAIL.has(status)) return task;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(3000, delay + 200);
  }
  throw new Error("Wiro görev zaman aşımı");
}

async function answerFromTask(task: Record<string, unknown>): Promise<string> {
  const fail = taskFailed(task);
  if (fail) throw new Error(fail);
  const text = extractWiroAnswer(task);
  if (!text) throw new Error("Wiro görev çıktısı yok");
  return text;
}

async function followTask(
  creds: WiroCreds,
  json: Record<string, unknown>,
  signed: boolean,
): Promise<string | null> {
  const done = taskFrom(json);
  if (done && (String(done.status ?? "") === TERMINAL_OK || TERMINAL_FAIL.has(String(done.status ?? "")) || done.outputs || done.debugoutput)) {
    return answerFromTask(done);
  }
  const u = unwrap(json);
  const taskid = u.taskid != null ? String(u.taskid) : "";
  const token = typeof u.socketaccesstoken === "string" ? u.socketaccesstoken : undefined;
  if (!taskid && !token) return null;
  return answerFromTask(await pollDetail(creds, taskid, token, signed));
}

export type WiroRunInput = {
  prompt: string;
  userId: string;
  sessionId: string;
  systemInstructions?: string;
  thinkingLevel?: "low" | "medium" | "high";
  maxOutputTokens?: number;
};

/**
 * Finite model: önce POST .../sync; olmazsa POST .../Run + POST /Task/Detail.
 * stream=true bu sohbet döngüsünde yok (widget final JSON bekler).
 */
export async function runWiroGeminiFlash(creds: WiroCreds, input: WiroRunInput): Promise<string> {
  const payload: Record<string, unknown> = {
    prompt: input.prompt,
    user_id: input.userId,
    session_id: input.sessionId,
    thinkingLevel: input.thinkingLevel ?? "low",
    maxOutputTokens: Math.min(65536, Math.max(1, input.maxOutputTokens ?? 1024)),
  };
  if (input.systemInstructions?.trim()) payload.systemInstructions = input.systemInstructions.trim();

  const attempts: { signed: boolean; multipart: boolean }[] = [
    { signed: true, multipart: false },
    { signed: true, multipart: true },
    { signed: false, multipart: false },
  ];

  let lastErr = "Wiro yanıt veremedi";

  for (const opts of attempts) {
    try {
      const sync = await wiroPost(SYNC_PATH, creds, payload, 70_000, opts);
      if (sync.http !== 404 && sync.http !== 405) {
        if (sync.http < 400 && sync.json.result !== false) {
          const text = await followTask(creds, sync.json, opts.signed);
          if (text) return text;
        } else {
          lastErr = failMsg(sync.http, sync.json, "Wiro sync");
        }
      }

      const run = await wiroPost(RUN_PATH, creds, payload, 30_000, opts);
      if (run.http >= 400 || run.json.result === false) {
        lastErr = failMsg(run.http, run.json, "Wiro Run");
        continue;
      }
      const text = await followTask(creds, run.json, opts.signed);
      if (text) return text;
      lastErr = "Wiro Run taskid yok";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(lastErr.slice(0, 400));
}
