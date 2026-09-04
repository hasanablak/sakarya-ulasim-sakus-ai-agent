import { useState } from "react";

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
      <section className="card embed-snippet">
        <h2>Sayfana ekle</h2>
        <p className="muted">Kaydedince benzersiz bir embed ID oluşur; script adresi ona bağlanır. Slug değişse bile URL aynı kalır.</p>
      </section>
    );
  }

  return (
    <section className="card embed-snippet">
      <h2>Sayfana ekle</h2>
      <p className="muted">
        Her webchat’in kalıcı bir ID’si var. Aynı sayfaya birden fazla widget yapıştırılabilir; ID’ler çakışmaz. Slug
        sadece yönetim içindir.
      </p>
      <label>
        Embed ID
        <span className="snippet-row">
          <input readOnly value={embedKey!} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => void copy("id", embedKey!)}>
            {copied === "id" ? "Kopyalandı" : "Kopyala"}
          </button>
        </span>
      </label>
      <label>
        Script URL
        <span className="snippet-row">
          <input readOnly value={src} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => void copy("url", src)}>
            {copied === "url" ? "Kopyalandı" : "Kopyala"}
          </button>
        </span>
      </label>
      <label>
        HTML
        <span className="snippet-row">
          <textarea readOnly rows={2} value={tag} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => void copy("tag", tag)}>
            {copied === "tag" ? "Kopyalandı" : "Kopyala"}
          </button>
        </span>
      </label>
    </section>
  );
}
