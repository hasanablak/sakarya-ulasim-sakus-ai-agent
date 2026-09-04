import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChatMd } from "../../components/ChatMd";
import { api } from "../../api";
import {
  cardCls,
  cx,
  errText,
  linkCls,
  muted,
  pageStack,
  pageTitle,
  pillOn,
  tableCls,
  tableWrap,
  tdCls,
  thCls,
  trendDown,
  trCls,
} from "./ui";

type Mesaj = {
  id: number;
  rol: string;
  icerik: string;
  meta: Record<string, unknown> | null;
  tool_ad: string | null;
  fonksiyon_kod: string | null;
  created_at: string;
};

type Oturum = {
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

function fmt(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("tr-TR");
}

function rolAd(rol: string) {
  if (rol === "user") return "Müşteri";
  if (rol === "assistant") return "Asistan";
  if (rol === "tool") return "Tool";
  if (rol === "system") return "Sistem";
  return rol;
}

export function SohbetDetayPage() {
  const { id } = useParams();
  const [oturum, setOturum] = useState<Oturum | null>(null);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [olaylar, setOlaylar] = useState<Olay[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .sohbet(id)
      .then((d) => {
        setOturum(d.oturum ?? null);
        setMesajlar(d.mesajlar ?? []);
        setOlaylar(d.olaylar ?? []);
      })
      .catch((e) => setErr(String(e.message)));
  }, [id]);

  return (
    <div className={pageStack}>
      <p>
        <Link className={linkCls} to="/admin/sohbetler">
          ← Gelen kutusu
        </Link>
      </p>
      <h1 className={pageTitle}>Sohbet</h1>
      {err && <p className={errText}>{err}</p>}
      {oturum && (
        <dl className={cx(cardCls, "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Webchat</dt>
            <dd className="mt-0.5 text-zinc-900 dark:text-zinc-50">
              {oturum.webchat_ad ?? "—"}
              {oturum.webchat_slug ? <span className={muted}> · {oturum.webchat_slug}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Agent</dt>
            <dd className="mt-0.5 text-zinc-900 dark:text-zinc-50">
              {oturum.agent_ad ?? "—"}
              {oturum.model ? (
                <span className={muted}>
                  {" "}
                  · {oturum.llm_saglayici} / {oturum.model}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Kaynak</dt>
            <dd className="mt-0.5 text-zinc-900 dark:text-zinc-50">
              {oturum.kaynak === "embed" ? "Embed" : "Site"}
              {oturum.host_origin ? ` · ${oturum.host_origin}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Zaman</dt>
            <dd className="mt-0.5 text-zinc-900 dark:text-zinc-50">
              {fmt(oturum.created_at)} → {fmt(oturum.updated_at)}
            </dd>
          </div>
          {oturum.origin_lat != null && oturum.origin_lng != null && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">Konum</dt>
              <dd className="mt-0.5 text-zinc-900 dark:text-zinc-50">
                {Number(oturum.origin_lat).toFixed(5)}, {Number(oturum.origin_lng).toFixed(5)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Oturum</dt>
            <dd className={cx("mt-0.5", muted)}>{oturum.id}</dd>
          </div>
        </dl>
      )}
      <div className="flex max-w-3xl flex-col gap-2">
        {mesajlar.map((m) => (
          <MesajBubble key={m.id} m={m} />
        ))}
      </div>
      {olaylar.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Olay kaydı</h2>
          <div className={tableWrap}>
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={thCls}>Zaman</th>
                  <th className={thCls}>Olay</th>
                  <th className={thCls}>Tool</th>
                  <th className={thCls}>Süre</th>
                  <th className={thCls}>Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {olaylar.map((o) => (
                  <tr key={o.id} className={trCls}>
                    <td className={cx(tdCls, "whitespace-nowrap")}>{fmt(o.created_at)}</td>
                    <td className={tdCls}>
                      <code className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{o.fonksiyon_kod}</code>
                    </td>
                    <td className={tdCls}>{o.tool_ad ?? "—"}</td>
                    <td className={tdCls}>{o.sure_ms != null ? `${o.sure_ms} ms` : "—"}</td>
                    <td className={tdCls}>
                      <span className={o.ok ? pillOn : trendDown}>{o.ok ? "tamam" : "hata"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MesajBubble({ m }: { m: Mesaj }) {
  const kind = typeof m.meta?.kind === "string" ? m.meta.kind : null;
  const hiddenCall = kind === "tool_calls" && !m.icerik?.trim();
  const sure = typeof m.meta?.sure_ms === "number" ? m.meta.sure_ms : null;
  const model = typeof m.meta?.model === "string" ? m.meta.model : null;
  const sag = typeof m.meta?.llm_saglayici === "string" ? m.meta.llm_saglayici : null;

  if (m.rol === "tool" || hiddenCall) {
    const ad = m.tool_ad || (typeof m.meta?.tool_ad === "string" ? m.meta.tool_ad : "tool");
    const ok = m.meta?.ok === false ? false : true;
    return (
      <div
        className={cx(
          "w-full rounded-xl border p-4 text-sm",
          ok
            ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            : "border-red-500 bg-red-500/10",
        )}
      >
        <small className="mb-1 block text-xs text-zinc-500">
          {hiddenCall ? "Tool çağrısı" : "Tool sonucu"} · {ad}
          {m.fonksiyon_kod ? ` → ${m.fonksiyon_kod}` : ""}
        </small>
        {hiddenCall ? (
          <div className={cx(muted, "text-xs")}>{JSON.stringify(m.meta?.tool_calls ?? [])}</div>
        ) : (
          <pre className="mt-1.5 max-h-44 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-zinc-900 dark:text-zinc-50">
            {truncate(m.icerik, 1200)}
          </pre>
        )}
        <time className="mt-1.5 block text-xs text-zinc-500">{fmt(m.created_at)}</time>
      </div>
    );
  }

  const isUser = m.rol === "user";
  return (
    <div
      className={cx(
        "max-w-[90%] rounded-xl border px-3 py-2.5 text-sm",
        isUser
          ? "self-end border-indigo-600 bg-indigo-600 text-white"
          : "self-start border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50",
      )}
    >
      <small className={cx("mb-1 block text-xs", isUser ? "text-white/70" : "text-zinc-500")}>
        {rolAd(m.rol)}
        {sag || model ? ` · ${[sag, model].filter(Boolean).join(" / ")}` : ""}
        {sure != null ? ` · ${sure} ms` : ""}
      </small>
      <div>
        <ChatMd text={m.icerik} />
      </div>
      <time className={cx("mt-1.5 block text-xs", isUser ? "text-white/55" : "text-zinc-500")}>{fmt(m.created_at)}</time>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
