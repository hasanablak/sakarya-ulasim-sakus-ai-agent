import { randomUUID } from "node:crypto";
import { getAgentForChat } from "./agent-store.js";
import {
  asMeta,
  ensureOturum,
  insertMesaj,
  isSessionId,
  listLlmGecmisi,
  listPublicMesajlar,
  logSohbetOlay,
  parseHostOrigin,
  touchOturum,
  type PublicMesaj,
} from "./chat-store.js";
import { completeLlm, llmDestekleniyor, type LlmMessage, type LlmToolCall } from "./llm.js";
import { listHatlar } from "./jobs.js";
import { calistirFonksiyon, fonksiyonVar } from "./tool-functions.js";
import { getPublicWebchat } from "./webchat-store.js";
import { yerSozluguPrompt } from "./yer-sozlugu.js";
import { query } from "./db.js";
import type { RowDataPacket } from "mysql2";

const MAX_MSG = 4000;
const MAX_TOOL_ROUNDS = 5;
const TOOL_JSON_CAP = 6000;

const TABAN_SISTEM =
  "Sen Sakarya Büyükşehir Belediyesi toplu taşıma asistanısın. Yanıtların Türkçe, kısa ve yolcuya yönelik olsun. " +
  "Tool sonuçlarındaki ham JSON’u olduğu gibi yapıştırma; özetle. Bilmediğin hat, saat veya konumu uydurma. " +
  "Yakın durak için yakin_duraklar tool’unu kullan. SAKUS haritası veya belediye sitesine yönlendirebilirsin. " +
  "“En yakın sefer” listedeki ilk sabah saati değil, Türkiye saatine göre şu andan SONRAKİ kalkıştır. " +
  "otobus_saat_sorgula çıktısındaki sonraki / yaklasan / simdi alanlarını kullan; bugün bittiyse yarını söyle.\n" +
  yerSozluguPrompt();

export async function handleChatTurn(input: {
  sessionId?: string;
  message: string;
  origin?: { lat: number; lng: number };
  webchatRef?: string;
  host?: string;
  headerOrigin?: string;
  referer?: string;
  kaynak?: string;
}): Promise<{ sessionId: string; mesajlar: PublicMesaj[] }> {
  const text = input.message.trim().slice(0, MAX_MSG);
  if (!text) throw new Error("mesaj boş");
  const sessionId = input.sessionId && isSessionId(input.sessionId) ? input.sessionId.trim() : randomUUID();
  const webchat = await getPublicWebchat(input.webchatRef?.trim() || undefined);
  const agent = webchat?.agent_id ? await getAgentForChat(webchat.agent_id) : null;
  const agentId = agent?.aktif ? agent.id : null;
  const hostOrigin = parseHostOrigin(input.host, input.headerOrigin, input.referer);
  const kaynak = input.kaynak === "embed" ? "embed" : "web";

  await ensureOturum({
    sessionId,
    kaynak,
    origin: input.origin,
    webchatId: webchat?.id ?? null,
    agentId,
    hostOrigin,
  });

  await insertMesaj(sessionId, "user", text, {
    kind: "user",
    webchat_id: webchat?.id ?? null,
    agent_id: agentId,
    host_origin: hostOrigin,
  });
  await logSohbetOlay(
    sessionId,
    "sohbet_mesaj",
    { webchat_id: webchat?.id ?? null, agent_id: agentId, host_origin: hostOrigin, len: text.length, kaynak },
    true,
    0,
    webchat?.slug ?? null,
  );

  const t0 = Date.now();
  try {
    await produceReply({ sessionId, text, origin: input.origin, webchatId: webchat?.id ?? null, agent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[chat] llm hata:", msg);
    const kisa = msg.replace(/\s+/g, " ").trim().slice(0, 180);
    await insertMesaj(
      sessionId,
      "assistant",
      kisa ? `Asistan yanıt veremedi: ${kisa}` : "Şu an asistan yanıt veremedi. Biraz sonra tekrar dene.",
      {
        kind: "assistant",
        ok: false,
        error: msg.slice(0, 400),
        webchat_id: webchat?.id ?? null,
        agent_id: agentId,
      },
    );
    await logSohbetOlay(sessionId, "llm_cagri", { hata: msg.slice(0, 200) }, false, Date.now() - t0, agent?.llm_saglayici ?? null);
  }

  await touchOturum(sessionId, agentId);
  return { sessionId, mesajlar: await listPublicMesajlar(sessionId) };
}

async function produceReply(opts: {
  sessionId: string;
  text: string;
  origin?: { lat: number; lng: number };
  webchatId: number | null;
  agent: Awaited<ReturnType<typeof getAgentForChat>>;
}): Promise<void> {
  const { sessionId, text, origin, webchatId, agent } = opts;

  if (!agent || !agent.aktif) {
    const { replyText, meta } = await draftChatReply(text);
    await insertMesaj(sessionId, "assistant", replyText, {
      ...meta,
      kind: "assistant",
      kaynak: "kural",
      webchat_id: webchatId,
    });
    return;
  }

  if (!agent.api_token) {
    await insertMesaj(
      sessionId,
      "assistant",
      "Bu sohbet penceresine bir asistan bağlı ama API anahtarı yok. Yönetim panelinden agent’a token ekle.",
      { kind: "assistant", ok: false, neden: "token_yok", webchat_id: webchatId, agent_id: agent.id },
    );
    return;
  }

  if (!llmDestekleniyor(agent.llm_saglayici)) {
    await insertMesaj(
      sessionId,
      "assistant",
      "Bu agent desteklenmeyen bir LLM kullanıyor. Yönetim panelinden OpenAI, Claude, Gemini, Groq veya OpenRouter seç.",
      { kind: "assistant", ok: false, neden: "saglayici", llm_saglayici: agent.llm_saglayici, agent_id: agent.id },
    );
    return;
  }

  const t0 = Date.now();
  const messages = await buildLlmMessages(sessionId, agent.sistem_prompt, origin);
  const toolMap = new Map(agent.tools.map((t) => [t.ad, t.fonksiyon_kod]));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stepT = Date.now();
    const completion = await completeLlm({
      saglayici: agent.llm_saglayici,
      model: agent.model,
      token: agent.api_token ?? "",
      messages,
      tools: agent.tools,
    });
    const llmMs = Date.now() - stepT;

    if (completion.tool_calls.length) {
      messages.push({
        role: "assistant",
        content: completion.content,
        tool_calls: completion.tool_calls,
        extra_content: completion.extra_content,
        reasoning_details: completion.reasoning_details,
      });
      await insertMesaj(sessionId, "assistant", completion.content ?? "", {
        kind: "tool_calls",
        tool_calls: completion.tool_calls,
        extra_content: completion.extra_content ?? null,
        reasoning_details: completion.reasoning_details ?? null,
        llm_saglayici: agent.llm_saglayici,
        model: agent.model,
        sure_ms: llmMs,
        agent_id: agent.id,
        webchat_id: webchatId,
      });

      for (const tc of completion.tool_calls) {
        const fnKod = toolMap.get(tc.name);
        const result = await runTool(sessionId, tc, fnKod);
        const content = JSON.stringify(result).slice(0, TOOL_JSON_CAP);
        messages.push({ role: "tool", tool_call_id: tc.id, name: tc.name, content });
        await insertMesaj(sessionId, "tool", content, {
          kind: "tool_result",
          tool_ad: tc.name,
          fonksiyon_kod: fnKod ?? null,
          tool_call_id: tc.id,
          ok: Boolean(result.ok),
          agent_id: agent.id,
        });
      }
      continue;
    }

    const reply =
      completion.content?.trim() ||
      "Bunu netleştiremedim. Hat kodu, durak adı veya gitmek istediğin yeri yazabilirsin.";
    await insertMesaj(sessionId, "assistant", reply, {
      kind: "assistant",
      llm_saglayici: agent.llm_saglayici,
      model: agent.model,
      sure_ms: Date.now() - t0,
      llm_ms: llmMs,
      agent_id: agent.id,
      webchat_id: webchatId,
      ok: true,
    });
    await logSohbetOlay(
      sessionId,
      "llm_cagri",
      { saglayici: agent.llm_saglayici, model: agent.model, tur: round + 1 },
      true,
      Date.now() - t0,
      agent.ad,
    );
    return;
  }

  await insertMesaj(sessionId, "assistant", "Birkaç denemeden sonra yanıtı toparlayamadım. Soruyu biraz daha kısa yazıp tekrar dene.", {
    kind: "assistant",
    ok: false,
    neden: "max_tool_round",
    agent_id: agent.id,
  });
}

async function runTool(sessionId: string, tc: LlmToolCall, fnKod: string | undefined) {
  if (!fnKod || !fonksiyonVar(fnKod)) {
    return { ok: false, error: `bu agent “${tc.name}” tool’unu kullanamaz` };
  }
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(tc.arguments || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
  } catch {
    args = { _raw: tc.arguments };
  }
  return calistirFonksiyon(fnKod, args, { oturumId: sessionId, toolAd: tc.name });
}

async function buildLlmMessages(
  sessionId: string,
  sistemPrompt: string,
  origin?: { lat: number; lng: number },
): Promise<LlmMessage[]> {
  const loc =
    origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)
      ? `Kullanıcının tarayıcı konumu (yaklaşık): ${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}.`
      : "Kullanıcı konum paylaşmamış olabilir.";
  const simdi = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const messages: LlmMessage[] = [
    { role: "system", content: `${sistemPrompt.trim()}\n\n${TABAN_SISTEM}\nŞu an Türkiye: ${simdi}.\n${loc}` },
  ];
  const rows = await listLlmGecmisi(sessionId, 36);
  for (const r of rows) {
    const mapped = rowToLlm(r);
    if (mapped) messages.push(mapped);
  }
  return messages;
}

function rowToLlm(r: RowDataPacket): LlmMessage | null {
  const rol = String(r.rol);
  const icerik = String(r.icerik ?? "");
  const meta = asMeta(r.meta_json);
  if (rol === "user") return { role: "user", content: icerik };
  if (rol === "tool") {
    const id = typeof meta?.tool_call_id === "string" ? meta.tool_call_id : "";
    const name = typeof meta?.tool_ad === "string" ? meta.tool_ad : "tool";
    if (!id) return null;
    return { role: "tool", tool_call_id: id, name, content: icerik || "{}" };
  }
  if (rol === "assistant") {
    const rawCalls = meta?.tool_calls;
    const extra_content =
      meta?.extra_content && typeof meta.extra_content === "object" && !Array.isArray(meta.extra_content)
        ? (meta.extra_content as Record<string, unknown>)
        : undefined;
    const reasoning_details = meta?.reasoning_details;
    const tool_calls: LlmToolCall[] = Array.isArray(rawCalls)
      ? rawCalls
          .map((tc) => {
            if (!tc || typeof tc !== "object") return null;
            const o = tc as { id?: unknown; name?: unknown; arguments?: unknown; extra_content?: unknown };
            if (typeof o.id !== "string" || typeof o.name !== "string") return null;
            const extra =
              o.extra_content && typeof o.extra_content === "object" && !Array.isArray(o.extra_content)
                ? (o.extra_content as Record<string, unknown>)
                : undefined;
            return {
              id: o.id,
              name: o.name,
              arguments: typeof o.arguments === "string" ? o.arguments : "{}",
              ...(extra ? { extra_content: extra } : {}),
            };
          })
          .filter((x): x is LlmToolCall => Boolean(x))
      : [];
    if (!icerik.trim() && !tool_calls.length) return null;
    return {
      role: "assistant",
      content: icerik.trim() ? icerik : null,
      tool_calls: tool_calls.length ? tool_calls : undefined,
      extra_content,
      ...(reasoning_details != null ? { reasoning_details } : {}),
    };
  }
  return null;
}

async function draftChatReply(text: string): Promise<{ replyText: string; meta: Record<string, unknown> }> {
  const hatlar = await listHatlar();
  const lower = text.toLocaleLowerCase("tr");
  const match = hatlar.find(
    (h) =>
      lower.includes(h.kod.toLocaleLowerCase("tr")) ||
      lower.includes(h.slug) ||
      lower.includes(h.ad.toLocaleLowerCase("tr")),
  );

  if (match) {
    const vehicles = await query<RowDataPacket[]>(
      `SELECT bus_number, plate, lat, lng, speed, status, next_stop_name, route_name, updated_at
       FROM arac_son_konum WHERE hat_id = ? ORDER BY updated_at DESC`,
      [match.id],
    );
    if (!vehicles.length) {
      return {
        replyText: `${match.kod} ${match.ad} hattını veritabanında görüyorum ama anlık otobüs henüz yok. Admin panelinden bu hat için canlı takibi açabilirsin.`,
        meta: { hatId: match.id, vehicles: 0 },
      };
    }
    const lines = vehicles.slice(0, 6).map((v) => {
      const where = v.next_stop_name ? `sonraki durak ${v.next_stop_name}` : v.status;
      return `• Araç ${v.bus_number}${v.plate ? ` (${v.plate})` : ""} — ${where ?? ""}`;
    });
    return {
      replyText: `${match.kod} ${match.ad} üzerinde ${vehicles.length} araç kaydı var:\n${lines.join("\n")}`,
      meta: { hatId: match.id, vehicles: vehicles.length },
    };
  }

  const ornek = hatlar.slice(0, 5).map((h) => h.kod).join(", ");
  return {
    replyText:
      `Merhaba, SAKUS asistanıyım. Sakarya otobüs hatlarını sorabilir, durak ve sefer saati öğrenebilirsin.\n\n` +
      `Yönetim panelinde webchat’e bir agent ve API anahtarı bağlarsan yanıtlar yapay zekâ üzerinden gelir. ` +
      `Şimdilik bir hat kodu yazabilirsin (ör. ${ornek || "A1"}).`,
    meta: { hatCount: hatlar.length },
  };
}
