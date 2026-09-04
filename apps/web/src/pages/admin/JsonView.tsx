import { useState, type ReactNode } from "react";
import { cx } from "./ui";

export function parseJsonText(raw: string): unknown {
  const t = raw.trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return raw;
  }
}

export function JsonView({
  value,
  defaultOpen = 2,
  className,
}: {
  value: unknown;
  defaultOpen?: number;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-auto rounded-lg bg-zinc-950/[0.04] p-2.5 font-mono text-[12px] leading-5 text-zinc-800 dark:bg-black/25 dark:text-zinc-200",
        className,
      )}
    >
      <JsonNode value={value} depth={0} defaultOpen={defaultOpen} />
    </div>
  );
}

function JsonNode({
  value,
  depth,
  defaultOpen,
  name,
}: {
  value: unknown;
  depth: number;
  defaultOpen: number;
  name?: string;
}) {
  if (value === null) return <Line name={name}><Null /></Line>;
  if (typeof value === "boolean") return <Line name={name}><Bool v={value} /></Line>;
  if (typeof value === "number") return <Line name={name}><Num v={value} /></Line>;
  if (typeof value === "string") return <Line name={name}><Str v={value} /></Line>;
  if (Array.isArray(value)) {
    return <Collapsible name={name} label={`[${value.length}]`} depth={depth} defaultOpen={defaultOpen} empty={value.length === 0}>
      {value.map((item, i) => (
        <JsonNode key={i} value={item} depth={depth + 1} defaultOpen={defaultOpen} name={String(i)} />
      ))}
    </Collapsible>;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <Collapsible name={name} label={`{${entries.length}}`} depth={depth} defaultOpen={defaultOpen} empty={entries.length === 0}>
        {entries.map(([k, v]) => (
          <JsonNode key={k} value={v} depth={depth + 1} defaultOpen={defaultOpen} name={k} />
        ))}
      </Collapsible>
    );
  }
  return <Line name={name}><span>{String(value)}</span></Line>;
}

function Collapsible({
  name,
  label,
  depth,
  defaultOpen,
  empty,
  children,
}: {
  name?: string;
  label: string;
  depth: number;
  defaultOpen: number;
  empty: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(depth < defaultOpen);
  if (empty) {
    return (
      <Line name={name}>
        <span className="text-zinc-400">{label === "[]" || label.startsWith("[") ? "[]" : "{}"}</span>
      </Line>
    );
  }
  return (
    <div>
      <button
        type="button"
        className="flex max-w-full items-start gap-1 rounded px-0.5 text-left hover:bg-zinc-500/10"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="mt-0.5 inline-block w-3 shrink-0 text-[10px] text-zinc-400">{open ? "▾" : "▸"}</span>
        {name != null && (
          <>
            <Key v={name} />
            <span className="text-zinc-400">: </span>
          </>
        )}
        <span className="text-zinc-400">{label}</span>
      </button>
      {open && <div className="ml-3 border-l border-zinc-200 pl-2 dark:border-zinc-700">{children}</div>}
    </div>
  );
}

function Line({ name, children }: { name?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-0 break-words">
      {name != null && (
        <>
          <Key v={name} />
          <span className="text-zinc-400">: </span>
        </>
      )}
      {children}
    </div>
  );
}

function Key({ v }: { v: string }) {
  return <span className="text-violet-700 dark:text-violet-300">{v}</span>;
}

function Null() {
  return <span className="text-zinc-400">null</span>;
}

function Bool({ v }: { v: boolean }) {
  return <span className="text-amber-600 dark:text-amber-400">{String(v)}</span>;
}

function Num({ v }: { v: number }) {
  return <span className="text-sky-700 dark:text-sky-400">{v}</span>;
}

function Str({ v }: { v: string }) {
  const long = v.length > 160;
  const [open, setOpen] = useState(false);
  const shown = !long || open ? v : `${v.slice(0, 160)}…`;
  return (
    <span className="text-emerald-800 dark:text-emerald-400">
      "{shown}"
      {long && (
        <button type="button" className="ml-1 text-[10px] text-zinc-400 hover:underline" onClick={() => setOpen((x) => !x)}>
          {open ? "kısalt" : "tamamı"}
        </button>
      )}
    </span>
  );
}

export function toolOzet(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const data = o.data && typeof o.data === "object" && !Array.isArray(o.data) ? (o.data as Record<string, unknown>) : null;
  if (typeof o.error === "string" && o.error) return o.error;
  if (data) {
    if (typeof data.direkt_adet === "number") return `${data.direkt_adet} direkt hat`;
    if (typeof data.adet === "number") return `${data.adet} kayıt`;
    if (Array.isArray(data.hatlar)) return `${data.hatlar.length} hat`;
    if (Array.isArray(data.duraklar)) return `${data.duraklar.length} durak`;
    if (Array.isArray(data.direkt)) return `${data.direkt.length} direkt hat`;
  }
  if (o.ok === false) return "hata";
  if (o.ok === true) return "tamam";
  return null;
}
