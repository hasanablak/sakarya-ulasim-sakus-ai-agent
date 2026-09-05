import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import {
  btnSecondary,
  cx,
  errText,
  inputCls,
  linkCls,
  muted,
  pageHead,
  pageStack,
  pageSub,
  pageTitle,
  tableCls,
  tableWrap,
  tdCls,
  thCls,
  trCls,
} from "./ui";

type Hat = {
  id: number;
  kod: string;
  slug: string;
  ad: string;
  bus_type_name: string | null;
  bus_type_color: string | null;
  last_ingested_at: string | null;
};

function hatTuru(h: Hat) {
  return h.bus_type_name?.trim() || "Diğer";
}

function kodSirasi(a: string, b: string) {
  return a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" });
}

export function HatlarPage() {
  const [params, setParams] = useSearchParams();
  const [hatlar, setHatlar] = useState<Hat[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const tur = params.get("tur");

  useEffect(() => {
    api
      .adminHatlar()
      .then((d) => setHatlar(d.hatlar ?? []))
      .catch((e) => setErr(String((e as Error).message)));
  }, []);

  const turler = useMemo(() => {
    const map = new Map<string, { n: number; renk: string | null }>();
    for (const h of hatlar) {
      const ad = hatTuru(h);
      const cur = map.get(ad) ?? { n: 0, renk: h.bus_type_color };
      cur.n += 1;
      if (!cur.renk && h.bus_type_color) cur.renk = h.bus_type_color;
      map.set(ad, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0], "tr"));
  }, [hatlar]);

  const gosterilen = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return hatlar
      .filter((h) => {
        if (tur && hatTuru(h) !== tur) return false;
        if (!needle) return true;
        return [h.kod, h.ad, h.slug, hatTuru(h)].join(" ").toLocaleLowerCase("tr").includes(needle);
      })
      .sort((a, b) => kodSirasi(a.kod, b.kod));
  }, [hatlar, q, tur]);

  function secTur(ad: string | null) {
    const next = new URLSearchParams(params);
    if (!ad || ad === tur) next.delete("tur");
    else next.set("tur", ad);
    setParams(next, { replace: true });
  }

  return (
    <div className={pageStack}>
      <header className={pageHead}>
        <div>
          <h1 className={pageTitle}>Hatlar</h1>
          <p className={pageSub}>
            {gosterilen.length}
            {gosterilen.length !== hatlar.length ? ` / ${hatlar.length}` : ""} hat
            {tur ? ` · ${tur}` : ""}
          </p>
        </div>
      </header>
      {err && <p className={errText}>{err}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cx(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !tur
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
          )}
          onClick={() => secTur(null)}
        >
          Tümü
          <span className="ml-1.5 opacity-80">{hatlar.length}</span>
        </button>
        {turler.map(([ad, info]) => {
          const on = tur === ad;
          return (
            <button
              key={ad}
              type="button"
              className={cx(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                on ? "text-white" : "bg-white text-zinc-700 hover:border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200",
              )}
              style={
                on
                  ? { background: info.renk || "#4f46e5", borderColor: info.renk || "#4f46e5" }
                  : { borderColor: info.renk || undefined }
              }
              onClick={() => secTur(ad)}
            >
              {ad}
              <span className="ml-1.5 opacity-80">{info.n}</span>
            </button>
          );
        })}
      </div>

      <form
        className="flex max-w-xl items-center gap-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          className={inputCls}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kod, ad veya slug ara"
        />
        {q && (
          <button type="button" className={btnSecondary} onClick={() => setQ("")}>
            Temizle
          </button>
        )}
      </form>

      <div className={tableWrap}>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={thCls}>Kod</th>
              <th className={thCls}>Ad</th>
              <th className={thCls}>Tür</th>
              <th className={thCls}>Son çekim</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {gosterilen.length === 0 && (
              <tr>
                <td colSpan={5} className={cx(tdCls, muted)}>
                  Eşleşen hat yok.
                </td>
              </tr>
            )}
            {gosterilen.map((h) => (
              <tr key={h.id} className={trCls}>
                <td className={tdCls}>
                  <strong>{h.kod}</strong>
                </td>
                <td className={tdCls}>{h.ad}</td>
                <td className={tdCls}>
                  <span
                    className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ background: h.bus_type_color || "#4f46e5" }}
                  >
                    {hatTuru(h)}
                  </span>
                </td>
                <td className={cx(tdCls, muted)}>
                  {h.last_ingested_at ? new Date(h.last_ingested_at).toLocaleString("tr-TR") : "—"}
                </td>
                <td className={tdCls}>
                  <Link className={linkCls} to={`/admin/hatlar/${h.slug}`}>
                    Detay
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
