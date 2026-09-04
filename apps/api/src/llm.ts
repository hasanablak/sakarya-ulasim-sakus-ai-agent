import { FONKSIYONLAR, fonksiyonByKod, fonksiyonJsonSchema, type FonksiyonTanim } from "./tool-functions.js";
import type { AgentChatTool } from "./agent-store.js";

export type LlmMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: LlmToolCall[];
      extra_content?: Record<string, unknown>;
      reasoning_details?: unknown;
    }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: string;
  extra_content?: Record<string, unknown>;
};

export type LlmCompletion = {
  content: string | null;
  tool_calls: LlmToolCall[];
  extra_content?: Record<string, unknown>;
  reasoning_details?: unknown;
};

/** Gemini 3 OpenAI-compat: imza yoksa 400; Google’ın atlama dizesi eski turları kurtarır. */
const GEMINI_SKIP_THOUGHT = "skip_thought_signature_validator";

type OpenAiToolCallRaw = {
  id?: string;
  function?: { name?: string; arguments?: string };
  extra_content?: unknown;
};

function asExtraContent(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

function hasThoughtSignature(extra?: Record<string, unknown>): boolean {
  if (!extra) return false;
  for (const key of ["google", "vertex"] as const) {
    const nest = extra[key];
    if (nest && typeof nest === "object" && "thought_signature" in nest) {
      return typeof (nest as { thought_signature?: unknown }).thought_signature === "string";
    }
  }
  return typeof extra.thought_signature === "string";
}

const OPENAI_COMPAT: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

export function llmDestekleniyor(saglayici: string): boolean {
  return saglayici === "anthropic" || saglayici in OPENAI_COMPAT;
}

export function toolOpenAiDefs(tools: AgentChatTool[]) {
  return tools.map((t) => {
    const fn: FonksiyonTanim | undefined = fonksiyonByKod(t.fonksiyon_kod) ?? FONKSIYONLAR.find((f) => f.kod === t.ad);
    const schema = fn ? fonksiyonJsonSchema(fn) : { type: "object" as const, properties: {}, required: [] as string[] };
    return {
      type: "function" as const,
      function: {
        name: t.ad,
        description: t.aciklama || fn?.aciklama || t.ad,
        parameters: schema,
      },
    };
  });
}

function toolAnthropicDefs(tools: AgentChatTool[]) {
  return tools.map((t) => {
    const fn = fonksiyonByKod(t.fonksiyon_kod);
    const schema = fn ? fonksiyonJsonSchema(fn) : { type: "object" as const, properties: {}, required: [] as string[] };
    return {
      name: t.ad,
      description: t.aciklama || fn?.aciklama || t.ad,
      input_schema: schema,
    };
  });
}

function sanitizeErr(s: string): string {
  return s
    .replace(/sk-or-v1-[a-zA-Z0-9._-]{8,}/g, "sk-or-…")
    .replace(/sk-[a-zA-Z0-9._-]{8,}/g, "sk-…")
    .replace(/cursor_[a-zA-Z0-9._-]{8,}/g, "cursor_…")
    .replace(/Bearer\s+\S+/gi, "Bearer …")
    .slice(0, 400);
}

function toOpenAiMessages(messages: LlmMessage[], googleThought = false) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
    }
    if (m.role === "assistant") {
      const out: Record<string, unknown> = { role: "assistant", content: m.content ?? "" };
      if (m.extra_content) out.extra_content = m.extra_content;
      if (m.reasoning_details != null) out.reasoning_details = m.reasoning_details;
      if (m.tool_calls?.length) {
        out.tool_calls = m.tool_calls.map((tc) => {
          const call: Record<string, unknown> = {
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments || "{}" },
          };
          if (tc.extra_content && hasThoughtSignature(tc.extra_content)) {
            call.extra_content = tc.extra_content;
          } else if (googleThought) {
            call.extra_content = { google: { thought_signature: GEMINI_SKIP_THOUGHT } };
          }
          return call;
        });
      }
      return out;
    }
    return { role: m.role, content: m.content };
  });
}

function toAnthropic(messages: LlmMessage[]): { system: string; messages: Record<string, unknown>[] } {
  const system = messages
    .filter((m): m is Extract<LlmMessage, { role: "system" }> => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const content: Record<string, unknown>[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls ?? []) {
        let input: unknown = {};
        try {
          input = JSON.parse(tc.arguments || "{}");
        } catch {
          input = { _raw: tc.arguments };
        }
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input });
      }
      out.push({ role: "assistant", content: content.length ? content : [{ type: "text", text: m.content ?? "" }] });
      continue;
    }
    const block = { type: "tool_result", tool_use_id: m.tool_call_id, content: m.content };
    const last = out[out.length - 1];
    if (last && last.role === "user" && Array.isArray(last.content) && (last.content[0] as { type?: string })?.type === "tool_result") {
      (last.content as unknown[]).push(block);
    } else {
      out.push({ role: "user", content: [block] });
    }
  }
  return { system, messages: out };
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error;
    const msg =
      typeof err === "string"
        ? err
        : err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(json).slice(0, 300);
    throw new Error(sanitizeErr(msg || `LLM HTTP ${res.status}`));
  }
  return json;
}

async function completeOpenAi(
  url: string,
  token: string,
  model: string,
  messages: LlmMessage[],
  tools: AgentChatTool[],
  googleThought = false,
): Promise<LlmCompletion> {
  const payload: Record<string, unknown> = {
    model,
    messages: toOpenAiMessages(messages, googleThought),
    temperature: 0.3,
    max_tokens: 1024,
  };
  if (tools.length) {
    payload.tools = toolOpenAiDefs(tools);
    payload.tool_choice = "auto";
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
  if (url.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://sakus.sakarya.bel.tr";
    headers["X-Title"] = "SAKUS";
  }
  const json = (await postJson(url, headers, payload)) as {
    choices?: {
      message?: {
        content?: string | null;
        extra_content?: unknown;
        reasoning_details?: unknown;
        tool_calls?: OpenAiToolCallRaw[];
      };
    }[];
  };
  const msg = json.choices?.[0]?.message;
  const tool_calls: LlmToolCall[] = (msg?.tool_calls ?? [])
    .filter((tc) => tc.function?.name)
    .map((tc) => {
      const extra = asExtraContent(tc.extra_content);
      return {
        id: tc.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        name: String(tc.function?.name),
        arguments: tc.function?.arguments || "{}",
        ...(extra ? { extra_content: extra } : {}),
      };
    });
  const content = typeof msg?.content === "string" && msg.content.trim() ? msg.content : null;
  const extra_content = asExtraContent(msg?.extra_content);
  const reasoning_details = msg?.reasoning_details;
  return {
    content,
    tool_calls,
    ...(extra_content ? { extra_content } : {}),
    ...(reasoning_details != null ? { reasoning_details } : {}),
  };
}

async function completeAnthropic(
  token: string,
  model: string,
  messages: LlmMessage[],
  tools: AgentChatTool[],
): Promise<LlmCompletion> {
  const { system, messages: anthMessages } = toAnthropic(messages);
  const payload: Record<string, unknown> = {
    model,
    max_tokens: 1024,
    temperature: 0.3,
    system,
    messages: anthMessages,
  };
  if (tools.length) payload.tools = toolAnthropicDefs(tools);
  const json = (await postJson(
    "https://api.anthropic.com/v1/messages",
    {
      "x-api-key": token,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    payload,
  )) as { content?: { type?: string; text?: string; id?: string; name?: string; input?: unknown }[] };
  const blocks = json.content ?? [];
  const texts = blocks.filter((b) => b.type === "text" && b.text).map((b) => String(b.text));
  const tool_calls: LlmToolCall[] = blocks
    .filter((b) => b.type === "tool_use" && b.name)
    .map((b) => ({
      id: String(b.id || `call_${Math.random().toString(36).slice(2, 10)}`),
      name: String(b.name),
      arguments: JSON.stringify(b.input ?? {}),
    }));
  return { content: texts.join("\n").trim() || null, tool_calls };
}

export async function completeLlm(opts: {
  saglayici: string;
  model: string;
  token: string;
  messages: LlmMessage[];
  tools: AgentChatTool[];
}): Promise<LlmCompletion> {
  const sag = opts.saglayici.trim().toLowerCase();
  if (sag === "anthropic") {
    return completeAnthropic(opts.token, opts.model, opts.messages, opts.tools);
  }
  const url = OPENAI_COMPAT[sag];
  if (!url) throw new Error(`desteklenmeyen LLM: ${opts.saglayici}`);
  return completeOpenAi(url, opts.token, opts.model, opts.messages, opts.tools, sag === "google");
}
