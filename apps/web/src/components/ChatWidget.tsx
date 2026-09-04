import { FormEvent, useEffect, useRef, useState } from "react";
import { DEFAULT_WEBCHAT_TEMA, type WebchatPublic } from "@sakus/shared";
import { api, getSessionId, setSessionId, type ChatMessage } from "../api";
import { ChatShell } from "./ChatShell";

const FALLBACK: WebchatPublic = {
  id: 0,
  embed_key: "",
  slug: "public",
  ad: "Ana site",
  agent_id: null,
  agent_ad: null,
  baslik: "SAKUS sohbet",
  karsilama: "Hat kodu yaz (ör. A1) veya “nasıl çalışır?” diye sor.",
  placeholder: "Mesaj yaz…",
  fab_ac: "Sohbet",
  fab_kapat: "Kapat",
  konum: "sag_alt",
  tema: { ...DEFAULT_WEBCHAT_TEMA },
  aktif: true,
  varsayilan: true,
};

export function ChatWidget({ slug, embed, host }: { slug?: string; embed?: boolean; host?: string }) {
  const [cfg, setCfg] = useState<WebchatPublic | null>(slug ? null : FALLBACK);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .webchat(slug)
      .then((d) => setCfg(d.webchat ?? null))
      .catch(() => setCfg(slug ? null : FALLBACK));
  }, [slug]);

  useEffect(() => {
    if (!cfg) return;
    const id = getSessionId(cfg.embed_key || cfg.slug, host);
    if (!id) return;
    api
      .chatGet(id)
      .then((d) => setMessages(d.mesajlar ?? []))
      .catch(() => undefined);
  }, [cfg, host]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (!embed || !cfg) return;
    const el = dockRef.current;
    if (!el) return;
    const publish = () => {
      const r = el.getBoundingClientRect();
      window.parent.postMessage(
        {
          type: "sakus-webchat",
          embedKey: cfg.embed_key,
          slug: cfg.slug,
          konum: cfg.konum,
          width: Math.ceil(r.width) + 4,
          height: Math.ceil(r.height) + 4,
        },
        "*",
      );
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embed, cfg, open, messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setText("");
    try {
      const origin = await readOrigin();
      const data = await api.chatSend({
        sessionId: getSessionId(cfg.embed_key || cfg.slug, host) ?? undefined,
        message,
        origin,
        webchatSlug: cfg.slug,
        webchatKey: cfg.embed_key || undefined,
        host: host || window.location.origin,
        kaynak: embed ? "embed" : "web",
      });
      if (data.sessionId) setSessionId(data.sessionId, cfg.embed_key || cfg.slug, host);
      setMessages(data.mesajlar ?? []);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) return null;

  return (
    <ChatShell
      cfg={cfg}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      logRef={scroller}
      dockRef={dockRef}
      embed={embed}
      composer={
        <form onSubmit={send}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={cfg.placeholder}
            disabled={busy}
          />
          <button type="submit" disabled={busy}>
            {busy ? "…" : "Gönder"}
          </button>
        </form>
      }
    >
      {visibleChat(messages).length === 0 && <p className="hint">{cfg.karsilama}</p>}
      {visibleChat(messages).map((m) => (
        <div key={m.id} className={`bubble ${m.rol}`}>
          {m.icerik}
        </div>
      ))}
      {error && <p className="err">{error}</p>}
    </ChatShell>
  );
}

function visibleChat(rows: ChatMessage[]) {
  return rows.filter((m) => (m.rol === "user" || m.rol === "assistant") && m.icerik?.trim());
}

function readOrigin(): Promise<{ lat: number; lng: number } | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(undefined),
      { timeout: 2500, maximumAge: 60_000 },
    );
  });
}
