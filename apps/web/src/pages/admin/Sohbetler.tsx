import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { SohbetThread, avatarCls, initials, waListTime } from "./SohbetDetay";
import { cx, errText, muted } from "./ui";

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

export function SohbetlerPage() {
  const { id } = useParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [webchats, setWebchats] = useState<WebchatOpt[]>([]);
  const [webchatId, setWebchatId] = useState<number | "">("");
  const [q, setQ] = useState("");
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
      .catch((e) => setErr(String((e as Error).message)));
  }, [webchatId, id]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = [r.webchat_ad, r.agent_ad, r.last_user, r.last_assistant, r.host_origin, r.kaynak]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr");
      return hay.includes(needle);
    });
  }, [rows, q]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-white dark:bg-[#111b21]">
      <aside
        className={cx(
          "flex min-h-0 w-full shrink-0 flex-col border-r border-zinc-200 dark:border-[#222d34] md:w-[360px] lg:w-[400px]",
          id && "hidden md:flex",
        )}
      >
        <div className="shrink-0 space-y-2 border-b border-zinc-200 bg-[#f0f2f5] px-3 py-3 dark:border-[#222d34] dark:bg-[#202c33]">
          <div className="flex items-center justify-between px-1">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-[#e9edef]">Gelen kutusu</h1>
            <span className="text-xs text-zinc-500">{filtered.length}</span>
          </div>
          <input
            className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400 focus:ring-teal-600 dark:bg-[#111b21] dark:text-[#e9edef] dark:ring-[#222d34]"
            placeholder="Sohbet ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-teal-600 dark:bg-[#111b21] dark:text-[#e9edef] dark:ring-[#222d34]"
            value={webchatId === "" ? "" : String(webchatId)}
            onChange={(e) => setWebchatId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Tüm webchat’ler</option>
            {webchats.map((w) => (
              <option key={w.id} value={w.id}>
                {w.ad} ({w.slug})
              </option>
            ))}
          </select>
        </div>
        {err && <p className={cx(errText, "px-4 py-2 text-sm")}>{err}</p>}
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 && !err && (
            <li className={cx(muted, "px-4 py-8 text-center text-sm")}>
              Henüz sohbet yok. Site veya embed mesajları burada listelenir.
            </li>
          )}
          {filtered.map((r) => {
            const active = r.id === id;
            const title = r.webchat_ad ?? "Sohbet";
            const preview = r.last_user || r.last_assistant || "—";
            return (
              <li key={r.id}>
                <Link
                  to={`/admin/sohbetler/${r.id}`}
                  className={cx(
                    "flex gap-3 border-b border-zinc-100 px-3 py-3 hover:bg-zinc-50 dark:border-[#222d34] dark:hover:bg-[#202c33]",
                    active && "bg-[#f0f2f5] dark:bg-[#2a3942]",
                  )}
                >
                  <span className={cx("mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-white", avatarCls(r.id))}>
                    {initials(title)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900 dark:text-[#e9edef]">{title}</span>
                      <time className="shrink-0 text-[11px] text-zinc-400">{waListTime(r.updated_at)}</time>
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-[13px] text-zinc-500 dark:text-[#8696a0]">{preview}</span>
                    <span className="mt-0.5 block text-[11px] text-zinc-400">
                      {r.message_count} mesaj
                      {r.tool_count ? ` · ${r.tool_count} tool` : ""}
                      {r.kaynak === "embed" ? " · Embed" : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className={cx("flex min-h-0 min-w-0 flex-1 flex-col", !id && "hidden md:flex")}>
        {id ? (
          <SohbetThread id={id} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-[#efeae2] px-6 text-center dark:bg-[#0b141a]">
            <div className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-white/80 text-3xl dark:bg-[#202c33]">💬</div>
            <p className="text-lg font-medium text-zinc-700 dark:text-[#e9edef]">Gelen kutusu</p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-[#8696a0]">
              Soldan bir sohbet seç. Müşteri, asistan ve tool sonuçları WhatsApp düzeninde görünür.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
