import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import {
  cx,
  errText,
  inputCls,
  labelCls,
  linkCls,
  muted,
  pageStack,
  pageSub,
  pageTitle,
  tableCls,
  tableWrap,
  tdCls,
  thCls,
  trCls,
} from "./ui";

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
    <div className={pageStack}>
      <div>
        <h1 className={pageTitle}>Gelen kutusu</h1>
        <p className={pageSub}>
          Webchat üzerinden gelen sohbetler. Müşteri mesajı, asistan yanıtı, hangi pencere ve agent kullanıldığı burada.
        </p>
      </div>
      {err && <p className={errText}>{err}</p>}
      <div className="max-w-xs">
        <label className={labelCls}>
          Webchat
          <select
            className={inputCls}
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
        <p className={muted}>Henüz sohbet yok. Site veya embed üzerinden gelen mesajlar burada listelenir.</p>
      )}
      {rows.length > 0 && (
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={thCls}>Zaman</th>
                <th className={thCls}>Webchat</th>
                <th className={thCls}>Müşteri</th>
                <th className={thCls}>Asistan</th>
                <th className={thCls}>Kaynak</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id} className={trCls}>
                  <td className={cx(tdCls, "whitespace-nowrap")}>
                    {fmt(r.updated_at)}
                    <div className={cx(muted, "text-xs")}>
                      {r.message_count} mesaj
                      {r.tool_count ? ` · ${r.tool_count} tool` : ""}
                    </div>
                  </td>
                  <td className={tdCls}>
                    {r.webchat_ad ?? "—"}
                    <div className={cx(muted, "text-xs")}>{r.agent_ad ?? "agent yok"}</div>
                  </td>
                  <td className={cx(tdCls, "max-w-[260px]")}>
                    <span className="line-clamp-2">{r.last_user ?? "—"}</span>
                  </td>
                  <td className={cx(tdCls, "max-w-[260px]")}>
                    <span className="line-clamp-2">{r.last_assistant ?? "—"}</span>
                  </td>
                  <td className={cx(tdCls, muted, "text-xs")}>
                    {r.kaynak === "embed" ? "Embed" : "Site"}
                    {r.host_origin ? <div>{r.host_origin}</div> : null}
                  </td>
                  <td className={tdCls}>
                    <Link className={linkCls} to={`/admin/sohbetler/${r.id}`}>
                      Aç
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
