import type { ReactNode } from "react";

/** Gemini’nin **kalın**, *italik* ve * madde işaretlerini balonda gerçek biçime çevirir. Ham HTML yok. */
export function ChatMd({ text }: { text: string }) {
  return <div className="chat-md">{parseBlocks(text)}</div>;
}

const LIST_RE = /^(\s*)(?:[-•]|\d+\.)\s+(.*)$/;
const STAR_LIST_RE = /^(\s*)\*\s+(.*)$/;
const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const INLINE_RE = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|`[^`\n]+?`|(?<!\*)\*(?!\s)[^*\n]+?(?<!\s)\*(?!\*))/g;

function parseBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) {
      i += 1;
      continue;
    }
    if (isListLine(lines[i])) {
      const items: string[][] = [];
      const ordered = /^\s*\d+\.\s+/.test(lines[i]);
      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
          if (i + 1 < lines.length && isListLine(lines[i + 1])) {
            i += 1;
            continue;
          }
          break;
        }
        const body = listBody(line);
        if (body != null) {
          items.push([body]);
          i += 1;
          continue;
        }
        if (items.length && !HEADING_RE.test(line)) {
          items[items.length - 1].push(line.trim());
          i += 1;
          continue;
        }
        break;
      }
      const Tag = ordered ? "ol" : "ul";
      out.push(
        <Tag key={k++}>
          {items.map((parts, j) => (
            <li key={j}>{renderLines(stripDanglingStar(parts))}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    const heading = lines[i].match(HEADING_RE);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h3" : heading[1].length === 2 ? "h4" : "h5";
      out.push(<Tag key={k++}>{parseInline(heading[2])}</Tag>);
      i += 1;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isListLine(lines[i]) && !HEADING_RE.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(<p key={k++}>{renderParagraph(para.join("\n"))}</p>);
  }
  return out;
}

function isListLine(line: string): boolean {
  return LIST_RE.test(line) || STAR_LIST_RE.test(line);
}

function listBody(line: string): string | null {
  const star = line.match(STAR_LIST_RE);
  if (star) return star[2];
  const other = line.match(LIST_RE);
  return other ? other[2] : null;
}

function stripDanglingStar(lines: string[]): string[] {
  const copy = [...lines];
  const last = copy[copy.length - 1];
  if (!last) return copy;
  const stars = last.match(/\*/g)?.length ?? 0;
  if (stars % 2 === 1 && /\*\s*$/.test(last) && !/(?<!\*)\*(?!\s)[^*\n]+?(?<!\s)\*\s*$/.test(last)) {
    copy[copy.length - 1] = last.replace(/\*\s*$/, "").trimEnd();
    if (!copy[copy.length - 1]) copy.pop();
  }
  return copy;
}

function renderLines(lines: string[]): ReactNode {
  return lines.map((line, idx) => (
    <span key={idx}>
      {idx > 0 && <br />}
      {parseInline(line)}
    </span>
  ));
}

function renderParagraph(raw: string): ReactNode {
  const t = raw.trim();
  if (t.startsWith("*") && !t.startsWith("**") && t.endsWith("*") && !t.endsWith("**") && t.length > 2) {
    return <em>{parseInline(t.slice(1, -1).trim())}</em>;
  }
  return parseInline(raw);
}

function parseInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  const re = new RegExp(INLINE_RE.source, "g");
  for (const m of text.matchAll(re)) {
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
