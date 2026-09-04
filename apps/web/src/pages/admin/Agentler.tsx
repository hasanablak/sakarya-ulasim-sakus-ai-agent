import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LLM_SAGLAYICILAR } from "@sakus/shared";
import { api } from "../../api";

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
    <div>
      <header className="page-head">
        <div>
          <h1>Agent'lar</h1>
          <p>Sistem prompt, LLM ve kullanabileceği tool’lar burada tanımlanır. Sohbet henüz bu kayıtlara bağlı değil.</p>
        </div>
        <Link to="/admin/agentler/yeni" className="ghost">
          Yeni agent
        </Link>
      </header>
      {err && <p className="err">{err}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Ad</th>
            <th>LLM</th>
            <th>Tool</th>
            <th>Durum</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                Henüz agent yok. Yeni agent ile başla.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const sag =
              LLM_SAGLAYICILAR.find((s) => s.id === r.llm_saglayici)?.ad ??
              (r.llm_saglayici === "cursor" ? "Cursor (kaldırıldı)" : r.llm_saglayici);
            return (
              <tr key={r.id}>
                <td>
                  <strong>{r.ad}</strong>
                  {r.aciklama && <em className="cell-sub">{r.aciklama}</em>}
                </td>
                <td>
                  {sag}
                  <em className="cell-sub">
                    {r.model}
                    {r.has_token ? ` · token …${r.token_son}` : " · token yok"}
                  </em>
                </td>
                <td>{r.tool_ids.length}</td>
                <td>
                  <span className={r.aktif ? "pill on" : "pill"}>{r.aktif ? "aktif" : "pasif"}</span>
                </td>
                <td>
                  <Link to={`/admin/agentler/${r.id}`}>Düzenle</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
