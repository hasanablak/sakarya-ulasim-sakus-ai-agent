import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChatMd } from "../../components/ChatMd";
import { api } from "../../api";
import { JsonView, parseJsonText, toolOzet } from "./JsonView";
import { cx, errText, muted, pillOn, trendDown } from "./ui";

export type InboxMesaj = {
  id: number;
  rol: string;
  icerik: string;
  meta: Record<string, unknown> | null;
  tool_ad: string | null;
  fonksiyon_kod: string | null;
  created_at: string;
};

export type InboxOturum = {
  id: string;
  kaynak: string;
  host_origin: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  webchat_ad: string | null;
  webchat_slug: string | null;
  agent_ad: string | null;
  llm_saglayici: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
};

type Olay = {
  id: number;
  tool_ad: string | null;
  fonksiyon_kod: string;
  input_json: unknown;
  ok: number;
  sure_ms: number | null;
  created_at: string;
};

const AVATAR = [
  "bg-teal-600",
  "bg-indigo-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-sky-600",
  "bg-emerald-700",
];

export function avatarCls(id: string) {
  let h = 0;
  for (const c of id) h = (h + c.charCodeAt(0)) % AVATAR.length;
  return AVATAR[h] ?? AVATAR[0];
}

export function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  const a = p[0]?.[0] ?? "?";
  const b = p.length > 1 ? p[p.length - 1][0] : p[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

export function waClock(s: string | null | undefined) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

export function waListTime(s: string | null | undefined) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return waClock(s);
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function waDayLabel(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Bugün";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Dün";
  return d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
}

function dayKey(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function SohbetThread({ id }: { id: string }) {
  const [oturum, setOturum] = useState<InboxOturum | null>(null);
  const [mesajlar, setMesajlar] = useState<InboxMesaj[]>([]);
  const [olaylar, setOlaylar] = useState<Olay[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [olayAcik, setOlayAcik] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setErr(null);
    setOturum(null);
    setMesajlar([]);
    api
      .sohbet(id)
      .then((d) => {
        setOturum(d.oturum ?? null);
        setMesajlar(d.mesajlar ?? []);
        setOlaylar(d.olaylar ?? []);
      })
      .catch((e) => setErr(String((e as Error).message)));
  }, [id]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mesajlar, id]);

  const baslik = oturum?.webchat_ad ?? "Sohbet";
  const alt = [oturum?.agent_ad, oturum?.kaynak === "embed" ? "Embed" : "Site", oturum?.host_origin]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#efeae2] dark:bg-[#0b141a]">
      <header className="flex shrink-0 items-center gap-3 border-b border-black/5 bg-[#f0f2f5] px-3 py-2.5 dark:border-white/5 dark:bg-[#202c33]">
        <Link
          to="/admin/sohbetler"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-600 hover:bg-black/5 md:hidden dark:text-[#e9edef] dark:hover:bg-white/5"
          aria-label="Listeye dön"
        >
          ←
        </Link>
        <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white", avatarCls(id))}>
          {initials(baslik)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-[#e9edef]">{baslik}</div>
          <div className="truncate text-xs text-zinc-500 dark:text-[#8696a0]">{alt || " "}</div>
        </div>
        {oturum?.origin_lat != null && oturum.origin_lng != null && (
          <span className="hidden shrink-0 rounded-full bg-black/5 px-2 py-1 font-mono text-[11px] text-zinc-600 sm:inline dark:bg-white/5 dark:text-zinc-300">
            {Number(oturum.origin_lat).toFixed(4)}, {Number(oturum.origin_lng).toFixed(4)}
          </span>
        )}
      </header>

      <div ref={scroller} className="wa-chat-bg min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-8">
        {err && <p className={cx(errText, "mb-3 text-sm")}>{err}</p>}
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {mesajlar.map((m, i) => {
            const prev = mesajlar[i - 1];
            const showDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-lg bg-white/80 px-3 py-1 text-[11px] font-medium text-zinc-600 shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
                      {waDayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <MesajSatir m={m} />
              </div>
            );
          })}
          {mesajlar.length === 0 && !err && <p className={cx(muted, "py-8 text-center text-sm")}>Mesaj yok.</p>}
        </div>
      </div>

      {olaylar.length > 0 && (
        <div className="shrink-0 border-t border-black/5 bg-[#f0f2f5] dark:border-white/5 dark:bg-[#202c33]">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-medium text-zinc-600 dark:text-[#8696a0]"
            onClick={() => setOlayAcik((v) => !v)}
          >
            Olay kaydı ({olaylar.length})
            <span>{olayAcik ? "▾" : "▸"}</span>
          </button>
          {olayAcik && (
            <ul className="max-h-40 overflow-y-auto border-t border-black/5 px-4 py-2 text-xs dark:border-white/5">
              {olaylar.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1">
                  <time className="text-zinc-400">{waClock(o.created_at)}</time>
                  <code className="font-mono text-indigo-600 dark:text-indigo-400">{o.fonksiyon_kod}</code>
                  {o.tool_ad && <span className="text-zinc-500">{o.tool_ad}</span>}
                  <span className={o.ok ? pillOn : trendDown}>{o.ok ? "tamam" : "hata"}</span>
                  {o.sure_ms != null && <span className="text-zinc-400">{o.sure_ms} ms</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MesajSatir({ m }: { m: InboxMesaj }) {
  const kind = typeof m.meta?.kind === "string" ? m.meta.kind : null;
  if (kind === "tool_calls") return <ToolCagriKart m={m} />;
  if (m.rol === "tool") return <ToolSonucKart m={m} />;
  if (m.rol === "system") {
    return (
      <div className="my-1 flex justify-center">
        <span className="max-w-[90%] rounded-lg bg-white/80 px-3 py-1.5 text-center text-xs text-zinc-600 dark:bg-[#182229] dark:text-[#8696a0]">
          {m.icerik}
        </span>
      </div>
    );
  }
  return <MetinBalon m={m} />;
}

function MetinBalon({ m }: { m: InboxMesaj }) {
  const isUser = m.rol === "user";
  const sure = typeof m.meta?.sure_ms === "number" ? m.meta.sure_ms : null;
  const model = typeof m.meta?.model === "string" ? m.meta.model : null;
  const sag = typeof m.meta?.llm_saglayici === "string" ? m.meta.llm_saglayici : null;
  const meta = [sag, model].filter(Boolean).join(" / ");
  return (
    <div className={cx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cx(
          "max-w-[85%] px-2.5 pb-1.5 pt-1.5 text-[13.5px] leading-snug shadow-sm sm:max-w-[75%]",
          isUser
            ? "rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-lg bg-[#d9fdd3] text-zinc-900 dark:bg-[#005c4b] dark:text-[#e9edef]"
            : "rounded-tl-sm rounded-tr-lg rounded-br-lg rounded-bl-lg bg-white text-zinc-900 dark:bg-[#202c33] dark:text-[#e9edef]",
        )}
      >
        {!isUser && (meta || sure != null) && (
          <div className="mb-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-400">
            Asistan{meta ? ` · ${meta}` : ""}
            {sure != null ? ` · ${sure} ms` : ""}
          </div>
        )}
        <div className={cx("wa-bubble-md", isUser && "[&_.chat-md_code]:bg-black/10")}>
          {m.icerik?.trim() ? <ChatMd text={m.icerik} /> : <span className="text-zinc-400">—</span>}
        </div>
        <div className={cx("mt-0.5 text-right text-[10px] leading-none", isUser ? "text-zinc-500 dark:text-white/50" : "text-zinc-400")}>
          {waClock(m.created_at)}
        </div>
      </div>
    </div>
  );
}

function ToolCagriKart({ m }: { m: InboxMesaj }) {
  const calls = Array.isArray(m.meta?.tool_calls) ? m.meta.tool_calls : [];
  return (
    <div className="flex justify-center py-1">
      <div className="w-full max-w-xl rounded-xl border border-sky-200/80 bg-sky-50/90 px-3 py-2 text-xs shadow-sm dark:border-sky-900 dark:bg-[#1a2a32]">
        <div className="mb-1.5 font-semibold text-sky-800 dark:text-sky-300">Tool çağrısı</div>
        {calls.length === 0 && <p className="text-zinc-500">Boş çağrı</p>}
        {calls.map((raw, i) => {
          const c = raw && typeof raw === "object" ? (raw as { name?: unknown; arguments?: unknown }) : {};
          const ad = typeof c.name === "string" ? c.name : "tool";
          const parsed = typeof c.arguments === "string" ? parseJsonText(c.arguments) : c.arguments ?? {};
          return (
            <div key={i} className="mt-2 first:mt-0">
              <code className="font-mono text-[11px] text-indigo-600 dark:text-indigo-300">{ad}</code>
              <JsonView value={parsed} defaultOpen={2} className="mt-1 max-h-56" />
            </div>
          );
        })}
        {m.icerik?.trim() ? (
          <div className="mt-2 border-t border-sky-200/70 pt-2 dark:border-sky-900">
            <ChatMd text={m.icerik} />
          </div>
        ) : null}
        <div className="mt-1 text-right text-[10px] text-zinc-400">{waClock(m.created_at)}</div>
      </div>
    </div>
  );
}

function ToolSonucKart({ m }: { m: InboxMesaj }) {
  const parsed = useMemo(() => parseJsonText(m.icerik ?? ""), [m.icerik]);
  const ok = m.meta?.ok === false || (parsed && typeof parsed === "object" && (parsed as { ok?: unknown }).ok === false) ? false : true;
  const ad = m.tool_ad || (typeof m.meta?.tool_ad === "string" ? m.meta.tool_ad : "tool");
  const ozet = toolOzet(parsed);
  const [kopyalandi, setKopyalandi] = useState(false);

  function kopyala() {
    const text = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
    void navigator.clipboard.writeText(text).then(() => {
      setKopyalandi(true);
      window.setTimeout(() => setKopyalandi(false), 1200);
    });
  }

  return (
    <div className="flex justify-center py-1">
      <div
        className={cx(
          "w-full max-w-xl rounded-xl border px-3 py-2 text-xs shadow-sm",
          ok
            ? "border-zinc-200/90 bg-white/90 dark:border-zinc-700 dark:bg-[#1f2c33]"
            : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
        )}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">Tool sonucu</span>
          <code className="font-mono text-[11px] text-indigo-600 dark:text-indigo-300">{ad}</code>
          {m.fonksiyon_kod && m.fonksiyon_kod !== ad && (
            <span className="text-zinc-400">→ {m.fonksiyon_kod}</span>
          )}
          <span className={ok ? pillOn : trendDown}>{ok ? ozet ?? "tamam" : ozet ?? "hata"}</span>
          <button type="button" className="ml-auto text-[11px] text-zinc-500 hover:underline" onClick={kopyala}>
            {kopyalandi ? "kopyalandı" : "kopyala"}
          </button>
        </div>
        {typeof parsed === "string" ? (
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px]">{parsed}</pre>
        ) : (
          <JsonView value={parsed} defaultOpen={2} className="max-h-80" />
        )}
        <div className="mt-1 text-right text-[10px] text-zinc-400">{waClock(m.created_at)}</div>
      </div>
    </div>
  );
}
