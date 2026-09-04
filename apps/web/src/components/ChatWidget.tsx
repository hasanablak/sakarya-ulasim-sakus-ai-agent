import { FormEvent, useEffect, useRef, useState } from "react";
import { DEFAULT_WEBCHAT_TEMA, type WebchatPublic } from "@sakus/shared";
import { api, getSessionId, setSessionId, type ChatMessage } from "../api";
import { baslatKonumIstegi, konumHint } from "../konum";
import { ChatMd } from "./ChatMd";
import { ChatShell } from "./ChatShell";

export const ORNEK_CUMLELER = [
  "Şu an bana en yakın hatlar neler?",
  "Çarşıya nasıl giderim?",
  "6 numaranın saatleri nelerdir?",
  "20 numara şu anda tam olarak nerede?",
];

const ORNEK_SOR_OLAY = "sakus-ornek-sor";

export function ornekSor(text: string) {
  void baslatKonumIstegi();
  window.dispatchEvent(new CustomEvent(ORNEK_SOR_OLAY, { detail: text }));
}

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
  const [konumBekliyor, setKonumBekliyor] = useState(false);
  const [konumUyari, setKonumUyari] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(raw: string) => Promise<void>>(async () => undefined);

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

  async function sendMessage(raw: string) {
    if (!cfg) return;
    const message = raw.trim();
    if (!message || busy) return;
    const yerel: ChatMessage = {
      id: -Date.now(),
      rol: "user",
      icerik: message,
      created_at: new Date().toISOString(),
    };
    setMessages((cur) => [...cur, yerel]);
    setBusy(true);
    setKonumBekliyor(true);
    setError(null);
    setText("");
    try {
      const konum = await baslatKonumIstegi();
      setKonumBekliyor(false);
      if (konum.ok) setKonumUyari(null);
      else setKonumUyari(konumHint(konum.neden));
      const data = await api.chatSend({
        sessionId: getSessionId(cfg.embed_key || cfg.slug, host) ?? undefined,
        message,
        origin: konum.ok ? konum.konum : undefined,
        konum_durum: konum.ok ? "var" : konum.neden,
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
      setKonumBekliyor(false);
      setBusy(false);
    }
  }

  sendRef.current = sendMessage;

  useEffect(() => {
    function onOrnek(ev: Event) {
      const msg = String((ev as CustomEvent<string>).detail ?? "").trim();
      if (!msg) return;
      setOpen(true);
      void sendRef.current(msg);
    }
    window.addEventListener(ORNEK_SOR_OLAY, onOrnek);
    return () => window.removeEventListener(ORNEK_SOR_OLAY, onOrnek);
  }, []);

  function send(e: FormEvent) {
    e.preventDefault();
    void sendMessage(text);
  }

  function toggleOpen() {
    setOpen((v) => {
      if (!v) void baslatKonumIstegi();
      return !v;
    });
  }

  if (!cfg) return null;

  return (
    <ChatShell
      cfg={cfg}
      open={open}
      onToggle={toggleOpen}
      logRef={scroller}
      dockRef={dockRef}
      embed={embed}
      composer={
        <div className="chat-composer">
          <div className="chat-suggest" aria-label="Örnek sorular">
            {ORNEK_CUMLELER.map((cumle) => (
              <button
                key={cumle}
                type="button"
                disabled={busy}
                onClick={() => void sendMessage(cumle)}
              >
                {cumle}
              </button>
            ))}
          </div>
          {konumUyari && <p className="hint chat-konum-hint">{konumUyari}</p>}
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
        </div>
      }
    >
      {visibleChat(messages).length === 0 && !busy && <p className="hint">{cfg.karsilama}</p>}
      {visibleChat(messages).map((m) => (
        <div key={m.id} className={`bubble ${m.rol}`}>
          <ChatMd text={m.icerik} />
        </div>
      ))}
      {busy && (
        <div className="bubble assistant is-typing" aria-live="polite">
          <span className="chat-typing">{konumBekliyor ? "Konum alınıyor" : "Asistan yazıyor"}</span>
        </div>
      )}
      {error && <p className="err">{error}</p>}
    </ChatShell>
  );
}

function visibleChat(rows: ChatMessage[]) {
  return rows.filter((m) => (m.rol === "user" || m.rol === "assistant") && m.icerik?.trim());
}
