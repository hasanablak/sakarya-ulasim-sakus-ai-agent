import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LLM_SAGLAYICILAR } from "@sakus/shared";
import { api } from "../../api";
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

export type AgentRow = {
  id: number;
  ad: string;
  aciklama: string | null;
  llm_saglayici: string;
  model: string;
  aktif: boolean;
  has_token: boolean;
  token_son: string | null;
  tool_ids: number[];
};

export function AgentlerPage() {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const d = await api.agentler();
    setRows(d.agentler ?? []);
  }

  useEffect(() => {
    load().catch((e) => setErr(String((e as Error).message)));
  }, []);

  return (
    <div className={pageStack}>
      <header className={pageHead}>
        <div>
          <h1 className={pageTitle}>Agent'lar</h1>
          <p className={pageSub}>Sistem prompt, LLM ve kullanabileceği tool’lar burada tanımlanır. Sohbet henüz bu kayıtlara bağlı değil.</p>
        </div>
        <Link to="/admin/agentler/yeni" className={btnPrimary}>
          Yeni agent
        </Link>
      </header>
      {err && <p className={errText}>{err}</p>}
      <div className={tableWrap}>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={thCls}>Ad</th>
              <th className={thCls}>LLM</th>
              <th className={thCls}>Tool</th>
              <th className={thCls}>Durum</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={cx(tdCls, muted)}>
                  Henüz agent yok. Yeni agent ile başla.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const sag =
                LLM_SAGLAYICILAR.find((s) => s.id === r.llm_saglayici)?.ad ??
                (r.llm_saglayici === "cursor"
                  ? "Cursor (kaldırıldı)"
                  : r.llm_saglayici === "wiro"
                    ? "Wiro (kaldırıldı)"
                    : r.llm_saglayici);
              return (
                <tr key={r.id} className={trCls}>
                  <td className={tdCls}>
                    <strong>{r.ad}</strong>
                    {r.aciklama && <em className="mt-1 block text-xs not-italic text-zinc-500">{r.aciklama}</em>}
                  </td>
                  <td className={tdCls}>
                    {sag}
                    <em className="mt-1 block text-xs not-italic text-zinc-500">
                      {r.model}
                      {r.has_token ? ` · token …${r.token_son}` : " · token yok"}
                    </em>
                  </td>
                  <td className={tdCls}>{r.tool_ids.length}</td>
                  <td className={tdCls}>
                    <span className={r.aktif ? pillOn : pillOff}>{r.aktif ? "aktif" : "pasif"}</span>
                  </td>
                  <td className={tdCls}>
                    <Link className={linkCls} to={`/admin/agentler/${r.id}`}>
                      Düzenle
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
