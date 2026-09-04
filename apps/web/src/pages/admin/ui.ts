export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-500 active:bg-indigo-700 transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-50 px-4 py-2 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none";

export const btnDanger =
  "inline-flex items-center justify-center bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-400 active:bg-red-600 transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none";

export const btnGhost =
  "inline-flex items-center justify-center rounded-lg p-2 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors duration-150";

export const inputCls =
  "w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 rounded-lg px-3 py-2 outline-none focus:border-indigo-600 dark:focus:border-indigo-500";

export const cardShell =
  "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm hover:shadow-md transition-shadow";

export const cardCls = cx(cardShell, "p-6");

export const tableWrap =
  "overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow";

export const tableCls = "w-full divide-y divide-zinc-200 dark:divide-zinc-800";

export const thCls =
  "bg-zinc-50 dark:bg-zinc-900 px-4 text-left text-xs uppercase tracking-wide text-zinc-500 font-medium h-14";

export const tdCls = "px-4 h-14 text-sm text-zinc-900 dark:text-zinc-50 align-middle";

export const trCls = "hover:bg-zinc-50 dark:hover:bg-zinc-900/50";

export const pageHead = "flex flex-wrap items-start justify-between gap-4";

export const pageTitle = "text-2xl font-bold text-zinc-900 dark:text-zinc-50";

export const pageSub = "mt-1 text-sm text-zinc-500";

export const muted = "text-zinc-500";

export const errText = "text-red-500";

export const linkCls = "text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium";

export const pillOn =
  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400";

export const pillOff =
  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800";

export const trendUp = "rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-500";

export const trendDown = "rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-500";

export const trendWarn = "rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-500";

export const labelCls = "flex flex-col gap-1.5 text-sm text-zinc-500";

export const checkRow = "flex flex-row items-start gap-2.5 text-sm text-zinc-900 dark:text-zinc-50";

export const checkInput = "mt-0.5 h-4 w-4 shrink-0 accent-indigo-600";

export const pageStack = "flex flex-col gap-6";

export const navItem = (active: boolean, collapsed: boolean) =>
  cx(
    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
    collapsed && "justify-center",
    active
      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"
      : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50",
  );

const THEME_KEY = "sakus-admin-theme";
const COLLAPSE_KEY = "sakus-admin-sidebar";

export function readAdminDark(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) === "dark";
  } catch {
    return false;
  }
}

export function writeAdminDark(dark: boolean) {
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    /* ignore */
  }
}

export function readAdminCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAdminCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}
