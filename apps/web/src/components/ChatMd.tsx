import type { ReactNode } from "react";

/** Gemini’nin **kalın** / *italik* işaretlerini balonda gerçek biçime çevirir. Ham HTML yok. */
export function ChatMd({ text }: { text: string }) {
  return <span className="chat-md">{parseInline(text)}</span>;
}

const TOKEN = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|`[^`\n]+?`|\*[^*\n]+?\*)/g;

function parseInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const raw = m[0];
    if (raw.startsWith("**") || raw.startsWith("__")) {
      out.push(<strong key={n++}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith("`")) {
      out.push(<code key={n++}>{raw.slice(1, -1)}</code>);
    } else {
      out.push(<em key={n++}>{raw.slice(1, -1)}</em>);
    }
    last = start + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
