import { useState } from "react";
import { btnSecondary, cardCls, cx, inputCls, labelCls, muted } from "../pages/admin/ui";

export function webchatScriptSrc(embedKey: string, origin = window.location.origin): string {
  return `${origin}/api/embed/${encodeURIComponent(embedKey)}.js`;
}

export function webchatScriptTag(embedKey: string, origin = window.location.origin): string {
  return `<script src="${webchatScriptSrc(embedKey, origin)}" async></script>`;
}

export function EmbedSnippet({ embedKey }: { embedKey: string | null }) {
  const [copied, setCopied] = useState<"url" | "tag" | "id" | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const ready = Boolean(embedKey);
  const src = ready ? webchatScriptSrc(embedKey!, origin) : "";
  const tag = ready ? webchatScriptTag(embedKey!, origin) : "";

  async function copy(kind: "url" | "tag" | "id", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  if (!ready) {
    return (
      <section className={cx(cardCls, "flex flex-col gap-2")}>
        <h2 className="m-0 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Sayfana ekle</h2>
        <p className={muted}>Kaydedince benzersiz bir embed ID oluşur; script adresi ona bağlanır. Slug değişse bile URL aynı kalır.</p>
      </section>
    );
  }

  return (
    <section className={cx(cardCls, "flex flex-col gap-4")}>
      <h2 className="m-0 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Sayfana ekle</h2>
      <p className={muted}>
        Her webchat’in kalıcı bir ID’si var. Aynı sayfaya birden fazla widget yapıştırılabilir; ID’ler çakışmaz. Slug
        sadece yönetim içindir.
      </p>
      <label className={labelCls}>
        Embed ID
        <span className="flex items-start gap-2">
          <input className={inputCls} readOnly value={embedKey!} onFocus={(e) => e.target.select()} />
          <button type="button" className={cx(btnSecondary, "shrink-0")} onClick={() => void copy("id", embedKey!)}>
            {copied === "id" ? "Kopyalandı" : "Kopyala"}
          </button>
        </span>
      </label>
      <label className={labelCls}>
        Script URL
        <span className="flex items-start gap-2">
          <input className={cx(inputCls, "font-mono text-sm")} readOnly value={src} onFocus={(e) => e.target.select()} />
          <button type="button" className={cx(btnSecondary, "shrink-0")} onClick={() => void copy("url", src)}>
            {copied === "url" ? "Kopyalandı" : "Kopyala"}
          </button>
        </span>
      </label>
      <label className={labelCls}>
        HTML
        <span className="flex items-start gap-2">
          <textarea className={cx(inputCls, "font-mono text-sm")} readOnly rows={2} value={tag} onFocus={(e) => e.target.select()} />
          <button type="button" className={cx(btnSecondary, "shrink-0")} onClick={() => void copy("tag", tag)}>
            {copied === "tag" ? "Kopyalandı" : "Kopyala"}
          </button>
        </span>
      </label>
    </section>
  );
}
