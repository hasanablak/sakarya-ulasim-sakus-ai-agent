import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { WebchatPublic } from "@sakus/shared";
import { api } from "../../api";
import { webchatScriptTag } from "../../components/EmbedSnippet";
import {
  btnPrimary,
  cx,
  errText,
  linkCls,
  muted,
  pageHead,
  pageStack,
  pageSub,
  pageTitle,
  pillOff,
  pillOn,
  tableCls,
  tableWrap,
  tdCls,
  thCls,
  trCls,
} from "./ui";

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
    <div className={pageStack}>
      <header className={pageHead}>
        <div>
          <h1 className={pageTitle}>Webchat'ler</h1>
          <p className={pageSub}>
            Hangi sohbet penceresinin hangi agent’ı kullanacağı ve görünümü burada tanımlanır. Varsayılan kayıt ana sitede
            görünür.
          </p>
        </div>
        <Link to="/admin/webchatler/yeni" className={btnPrimary}>
          Yeni webchat
        </Link>
      </header>
      {err && <p className={errText}>{err}</p>}
      <div className={tableWrap}>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={thCls}>Ad</th>
              <th className={thCls}>Agent</th>
              <th className={thCls}>Konum</th>
              <th className={thCls}>Durum</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={cx(tdCls, muted)}>
                  Kayıt yok. API açılışında varsayılan “Ana site” webchat’i eklenir.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={trCls}>
                <td className={tdCls}>
                  <strong>{r.ad}</strong>
                  <em className="mt-1 block text-xs not-italic text-zinc-500">
                    {r.baslik} · <code className="font-mono">{r.slug}</code>
                    {r.embed_key && (
                      <>
                        <br />
                        ID <code className="font-mono">{r.embed_key}</code>
                      </>
                    )}
                  </em>
                </td>
                <td className={tdCls}>{r.agent_ad ?? <span className={muted}>seçilmedi</span>}</td>
                <td className={tdCls}>{r.konum === "sol_alt" ? "sol alt" : "sağ alt"}</td>
                <td className={tdCls}>
                  <span className={r.aktif ? pillOn : pillOff}>{r.aktif ? "aktif" : "pasif"}</span>
                  {r.varsayilan && <span className={cx(pillOn, "ml-1.5")}>varsayılan</span>}
                </td>
                <td className={tdCls}>
                  <Link className={linkCls} to={`/admin/webchatler/${r.id}`}>
                    Düzenle
                  </Link>
                  {r.aktif && r.embed_key && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="bg-transparent p-0 text-indigo-600 underline dark:text-indigo-400"
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
    </div>
  );
}
