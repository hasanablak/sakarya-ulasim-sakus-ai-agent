import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";

type ToolRow = {
  id: number;
  ad: string;
  aciklama: string;
  fonksiyon_kod: string;
  aktif: number | boolean;
};

export function ToollarPage() {
  const [rows, setRows] = useState<ToolRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .toollar()
      .then((d) => setRows(d.toollar ?? []))
      .catch((e) => setErr(String((e as Error).message)));
  }, []);

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Tool'lar</h1>
          <p>
            Tool tek başına çalışmaz; bir kod fonksiyonuna bağlanır. Beşinci fonksiyon{" "}
            <code>yakin_duraklar</code>: konum verince 600 m içindeki durakları ve geçen hatları döner — rota
            önerisinin temeli.
          </p>
        </div>
        <Link to="/admin/toollar/yeni" className="ghost">
          Yeni tool
        </Link>
      </header>
      {err && <p className="err">{err}</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Ad</th>
            <th>Fonksiyon</th>
            <th>Durum</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Kayıt yok. API açılışında varsayılan tool’lar eklenir.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <code>{r.ad}</code>
                <em className="cell-sub">{r.aciklama}</em>
              </td>
              <td>
                <code>{r.fonksiyon_kod}</code>
              </td>
              <td>
                <span className={r.aktif ? "pill on" : "pill"}>{r.aktif ? "aktif" : "pasif"}</span>
              </td>
              <td>
                <Link to={`/admin/toollar/${r.id}`}>Düzenle</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
