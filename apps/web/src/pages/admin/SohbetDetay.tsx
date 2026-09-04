import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChatMd } from "../../components/ChatMd";
import { api } from "../../api";

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
    <div>
      <p>
        <Link to="/admin/sohbetler">← Gelen kutusu</Link>
      </p>
      <h1>Sohbet</h1>
      {err && <p className="err">{err}</p>}
      {oturum && (
        <dl className="sohbet-meta">
          <div>
            <dt>Webchat</dt>
            <dd>
              {oturum.webchat_ad ?? "—"}
              {oturum.webchat_slug ? <span className="muted"> · {oturum.webchat_slug}</span> : null}
            </dd>
          </div>
          <div>
            <dt>Agent</dt>
            <dd>
              {oturum.agent_ad ?? "—"}
              {oturum.model ? (
                <span className="muted">
                  {" "}
                  · {oturum.llm_saglayici} / {oturum.model}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Kaynak</dt>
            <dd>
              {oturum.kaynak === "embed" ? "Embed" : "Site"}
              {oturum.host_origin ? ` · ${oturum.host_origin}` : ""}
            </dd>
          </div>
          <div>
            <dt>Zaman</dt>
            <dd>
              {fmt(oturum.created_at)} → {fmt(oturum.updated_at)}
            </dd>
          </div>
          {oturum.origin_lat != null && oturum.origin_lng != null && (
            <div>
              <dt>Konum</dt>
              <dd>
                {Number(oturum.origin_lat).toFixed(5)}, {Number(oturum.origin_lng).toFixed(5)}
              </dd>
            </div>
          )}
          <div>
            <dt>Oturum</dt>
            <dd className="muted">{oturum.id}</dd>
          </div>
        </dl>
      )}
      <div className="thread inbox-thread">
        {mesajlar.map((m) => (
          <MesajBubble key={m.id} m={m} />
        ))}
      </div>
      {olaylar.length > 0 && (
        <>
          <h2>Olay kaydı</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Olay</th>
                <th>Tool</th>
                <th>Süre</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {olaylar.map((o) => (
                <tr key={o.id}>
                  <td className="nowrap">{fmt(o.created_at)}</td>
                  <td>
                    <code>{o.fonksiyon_kod}</code>
                  </td>
                  <td>{o.tool_ad ?? "—"}</td>
                  <td>{o.sure_ms != null ? `${o.sure_ms} ms` : "—"}</td>
                  <td>{o.ok ? "tamam" : "hata"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
      <div className={`bubble tool ${ok ? "" : "is-bad"}`}>
        <small>
          {hiddenCall ? "Tool çağrısı" : "Tool sonucu"} · {ad}
          {m.fonksiyon_kod ? ` → ${m.fonksiyon_kod}` : ""}
        </small>
        {hiddenCall ? (
          <div className="muted small">{JSON.stringify(m.meta?.tool_calls ?? [])}</div>
        ) : (
          <pre className="tool-json">{truncate(m.icerik, 1200)}</pre>
        )}
        <time>{fmt(m.created_at)}</time>
      </div>
    );
  }

  return (
    <div className={`bubble ${m.rol}`}>
      <small>
        {rolAd(m.rol)}
        {sag || model ? ` · ${[sag, model].filter(Boolean).join(" / ")}` : ""}
        {sure != null ? ` · ${sure} ms` : ""}
      </small>
      <div>
        <ChatMd text={m.icerik} />
      </div>
      <time>{fmt(m.created_at)}</time>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
