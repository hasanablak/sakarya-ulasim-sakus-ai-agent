import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { WebchatPublic } from "@sakus/shared";
import { api } from "../../api";
import { webchatScriptTag } from "../../components/EmbedSnippet";

export function WebchatlerPage() {
  const [rows, setRows] = useState<WebchatPublic[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .webchatler()
      .then((d) => setRows(d.webchatler ?? []))
      .catch((e) => setErr(String((e as Error).message)));
  }, []);

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Webchat'ler</h1>
          <p>Hangi sohbet penceresinin hangi agent’ı kullanacağı ve görünümü burada tanımlanır. Varsayılan kayıt ana sitede görünür.</p>
        </div>
        <Link to="/admin/webchatler/yeni" className="ghost">
          Yeni webchat
        </Link>
      </header>
      {err && <p className="err">{err}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Ad</th>
            <th>Agent</th>
            <th>Konum</th>
            <th>Durum</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Kayıt yok. API açılışında varsayılan “Ana site” webchat’i eklenir.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.ad}</strong>
                <em className="cell-sub">
                  {r.baslik} · <code>{r.slug}</code>
                  {r.embed_key && (
                    <>
                      <br />
                      ID <code>{r.embed_key}</code>
                    </>
                  )}
                </em>
              </td>
              <td>{r.agent_ad ?? <span className="muted">seçilmedi</span>}</td>
              <td>{r.konum === "sol_alt" ? "sol alt" : "sağ alt"}</td>
              <td>
                <span className={r.aktif ? "pill on" : "pill"}>{r.aktif ? "aktif" : "pasif"}</span>
                {r.varsayilan && <span className="pill on" style={{ marginLeft: 6 }}>varsayılan</span>}
              </td>
              <td>
                <Link to={`/admin/webchatler/${r.id}`}>Düzenle</Link>
                {r.aktif && r.embed_key && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => void navigator.clipboard.writeText(webchatScriptTag(r.embed_key))}
                    >
                      Script kopyala
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
