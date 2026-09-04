import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { setAdminToken } from "../../api";
import {
  btnGhost,
  btnSecondary,
  cx,
  navItem,
  readAdminCollapsed,
  readAdminDark,
  writeAdminCollapsed,
  writeAdminDark,
} from "./ui";

const NAV = [
  { to: "/admin", label: "Hatlar", end: true, icon: IconHat },
  { to: "/admin/sohbetler", label: "Gelen kutusu", icon: IconInbox },
];

const NAV_AI = [
  { to: "/admin/agentler", label: "Agent'lar", icon: IconAgent },
  { to: "/admin/toollar", label: "Tool'lar", icon: IconTool },
  { to: "/admin/webchatler", label: "Webchat'ler", icon: IconChat },
];

function headerTitle(pathname: string): string {
  if (pathname === "/admin") return "Hatlar";
  if (pathname.startsWith("/admin/hatlar/")) return "Hat detayı";
  if (pathname.startsWith("/admin/sohbetler/")) return "Sohbet";
  if (pathname === "/admin/sohbetler") return "Gelen kutusu";
  if (pathname === "/admin/agentler/yeni") return "Yeni agent";
  if (pathname.startsWith("/admin/agentler/")) return "Agent düzenle";
  if (pathname === "/admin/agentler") return "Agent'lar";
  if (pathname === "/admin/toollar/yeni") return "Yeni tool";
  if (pathname.startsWith("/admin/toollar/")) return "Tool düzenle";
  if (pathname === "/admin/toollar") return "Tool'lar";
  if (pathname === "/admin/webchatler/yeni") return "Yeni webchat";
  if (pathname.startsWith("/admin/webchatler/")) return "Webchat düzenle";
  if (pathname === "/admin/webchatler") return "Webchat'ler";
  return "Yönetim";
}

export function AdminLayout() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [dark, setDark] = useState(readAdminDark);
  const [collapsed, setCollapsed] = useState(readAdminCollapsed);

  useEffect(() => {
    writeAdminDark(dark);
  }, [dark]);

  useEffect(() => {
    writeAdminCollapsed(collapsed);
  }, [collapsed]);

  return (
    <div className={cx(dark && "dark")}>
      <div className="flex min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <aside
          className={cx(
            "sticky top-0 flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
            collapsed ? "w-18" : "w-64",
          )}
        >
          <div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              S
            </span>
            {!collapsed && <strong className="truncate text-sm text-zinc-900 dark:text-zinc-50">Yönetim</strong>}
            <button
              type="button"
              className={cx(btnGhost, "ml-auto")}
              aria-label={collapsed ? "Menüyü aç" : "Menüyü daralt"}
              onClick={() => setCollapsed((v) => !v)}
            >
              <IconCollapse flipped={collapsed} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navItem(isActive, collapsed)} title={item.label}>
                <item.icon />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
            {!collapsed && (
              <span className="mt-3 px-3 py-2 text-xs uppercase tracking-wide text-zinc-500">AI Agent ve Tool'lar</span>
            )}
            {collapsed && <div className="my-2 border-t border-zinc-200 dark:border-zinc-800" />}
            {NAV_AI.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => navItem(isActive, collapsed)} title={item.label}>
                <item.icon />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
            <NavLink to="/" className={({ isActive }) => navItem(isActive, collapsed)} title="Siteye dön">
              <IconHome />
              {!collapsed && <span>Siteye dön</span>}
            </NavLink>
          </nav>
          <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
            <button
              type="button"
              className={cx(btnSecondary, "w-full", collapsed && "px-2")}
              title="Çıkış"
              onClick={() => {
                setAdminToken(null);
                nav("/admin/login");
              }}
            >
              {collapsed ? <IconLogout /> : "Çıkış"}
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <h1 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{headerTitle(pathname)}</h1>
            <button
              type="button"
              className={btnGhost}
              aria-label={dark ? "Açık tema" : "Koyu tema"}
              onClick={() => setDark((v) => !v)}
            >
              {dark ? <IconSun /> : <IconMoon />}
            </button>
          </header>
          <main className="mx-auto w-full max-w-screen-2xl px-6 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function IconHat() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 16h16M6 16V9l6-4 6 4v7M8 16v3m8-3v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconInbox() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 13h4l2 3h4l2-3h4v6H4v-6Z" strokeLinejoin="round" />
      <path d="M4 13 7 5h10l3 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAgent() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c1.2-3 3.5-4.5 7-4.5s5.8 1.5 7 4.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTool() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M14 7a4 4 0 0 1-5.5 5.5L5 16l3 3 3.5-3.5A4 4 0 0 1 14 7Z" strokeLinejoin="round" />
      <path d="M16 4l4 4" strokeLinecap="round" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M5 18 6.2 14A7 7 0 1 1 12 19H6Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 11.5 12 5l8 6.5V20H4v-8.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M10 6H6v12h4M10 12h9M16 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCollapse({ flipped }: { flipped: boolean }) {
  return (
    <svg className={cx("h-5 w-5", flipped && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M3 12h2m14 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M18 13.5A7 7 0 1 1 10.5 6 5.5 5.5 0 0 0 18 13.5Z" strokeLinejoin="round" />
    </svg>
  );
}
