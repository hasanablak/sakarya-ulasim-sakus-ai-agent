import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";

type Row = {
  id: string;
  kaynak: string;
  host_origin: string | null;
  webchat_id: number | null;
  webchat_ad: string | null;
  webchat_slug: string | null;
  agent_ad: string | null;
  last_user: string | null;
  last_assistant: string | null;
  message_count: number;
  tool_count: number;
  updated_at: string;
};

type WebchatOpt = { id: number; ad: string; slug: string };

function fmt(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("tr-TR");
}

export function SohbetlerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [webchats, setWebchats] = useState<WebchatOpt[]>([]);
  const [webchatId, setWebchatId] = useState<number | "">("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .webchatler()
      .then((d) => setWebchats(d.webchatler ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    api
      .sohbetler(webchatId === "" ? undefined : webchatId)
      .then((d) => setRows(d.oturumlar ?? []))
      .catch((e) => setErr(String(e.message)));
  }, [webchatId]);

  return (
    <div>
      <h1>Gelen kutusu</h1>
      <p className="muted">
        Webchat üzerinden gelen sohbetler. Müşteri mesajı, asistan yanıtı, hangi pencere ve agent kullanıldığı burada.
      </p>
      {err && <p className="err">{err}</p>}
      <div className="inbox-toolbar">
        <label>
          Webchat
          <select
            value={webchatId === "" ? "" : String(webchatId)}
            onChange={(e) => setWebchatId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Tümü</option>
            {webchats.map((w) => (
              <option key={w.id} value={w.id}>
                {w.ad} ({w.slug})
              </option>
            ))}
          </select>
        </label>
      </div>
      {rows.length === 0 && !err && (
        <p className="muted">Henüz sohbet yok. Site veya embed üzerinden gelen mesajlar burada listelenir.</p>
      )}
      {rows.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Webchat</th>
              <th>Müşteri</th>
              <th>Asistan</th>
              <th>Kaynak</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">
                  {fmt(r.updated_at)}
                  <div className="muted small">
                    {r.message_count} mesaj
                    {r.tool_count ? ` · ${r.tool_count} tool` : ""}
                  </div>
                </td>
                <td>
                  {r.webchat_ad ?? "—"}
                  <div className="muted small">{r.agent_ad ?? "agent yok"}</div>
                </td>
                <td className="inbox-preview">{r.last_user ?? "—"}</td>
                <td className="inbox-preview">{r.last_assistant ?? "—"}</td>
                <td className="muted small">
                  {r.kaynak === "embed" ? "Embed" : "Site"}
                  {r.host_origin ? <div>{r.host_origin}</div> : null}
                </td>
                <td>
                  <Link to={`/admin/sohbetler/${r.id}`}>Aç</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
