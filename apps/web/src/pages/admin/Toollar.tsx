import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
    <div className={pageStack}>
      <header className={pageHead}>
        <div>
          <h1 className={pageTitle}>Tool'lar</h1>
          <p className={pageSub}>
            Tool tek başına çalışmaz; bir kod fonksiyonuna bağlanır. Beşinci fonksiyon{" "}
            <code className="font-mono text-xs text-indigo-600 dark:text-indigo-400">yakin_duraklar</code>: konum verince
            600 m içindeki durakları ve geçen hatları döner — rota önerisinin temeli.
          </p>
        </div>
        <Link to="/admin/toollar/yeni" className={btnPrimary}>
          Yeni tool
        </Link>
      </header>
      {err && <p className={errText}>{err}</p>}
      <div className={tableWrap}>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={thCls}>Ad</th>
              <th className={thCls}>Fonksiyon</th>
              <th className={thCls}>Durum</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className={cx(tdCls, muted)}>
                  Kayıt yok. API açılışında varsayılan tool’lar eklenir.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={trCls}>
                <td className={tdCls}>
                  <code className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{r.ad}</code>
                  <em className="mt-1 block text-xs not-italic text-zinc-500">{r.aciklama}</em>
                </td>
                <td className={tdCls}>
                  <code className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{r.fonksiyon_kod}</code>
                </td>
                <td className={tdCls}>
                  <span className={r.aktif ? pillOn : pillOff}>{r.aktif ? "aktif" : "pasif"}</span>
                </td>
                <td className={tdCls}>
                  <Link className={linkCls} to={`/admin/toollar/${r.id}`}>
                    Düzenle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
