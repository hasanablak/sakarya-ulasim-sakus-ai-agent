import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, getAdminToken, setAdminToken } from "../../api";
import { btnGhost, cx, readAdminDark, writeAdminDark } from "./ui";

export function LoginPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(readAdminDark);

  useEffect(() => {
    writeAdminDark(dark);
  }, [dark]);

  if (getAdminToken()) return <Navigate to="/admin" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const data = await api.adminLogin(password);
      setAdminToken(data.token);
      nav("/admin");
    } catch (err) {
      setError(String((err as Error).message));
      setBusy(false);
    }
  }

  return (
    <div className={cx(dark && "dark")}>
      <div className="flex min-h-screen font-sans text-zinc-900 dark:text-zinc-50">
        <aside className="relative hidden w-[min(44vw,520px)] shrink-0 overflow-hidden bg-zinc-950 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-600/40 blur-3xl" />
            <div className="absolute -bottom-16 right-0 h-72 w-72 rounded-full bg-emerald-500/25 blur-3xl" />
            <div className="absolute inset-0 opacity-40">
              <RouteArt />
            </div>
          </div>
          <div className="relative px-10 pt-10">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <strong className="block text-sm font-semibold tracking-tight">SAKUS Asistan</strong>
                <span className="text-xs text-white/60">Sakarya ulaşım rehberi</span>
              </div>
            </div>
            <h1 className="mt-16 text-4xl font-bold tracking-tight">Yönetim paneli</h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              Hatlar, gelen kutusu ve sohbet asistanı tek yerde. Yolcuya giden yanıt buradan tanımlanır.
            </p>
          </div>
          <ul className="relative mb-10 space-y-3 px-10 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                <IconHat />
              </span>
              Hat, durak ve sefer
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                <IconInbox />
              </span>
              Gelen kutusu
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                <IconSpark />
              </span>
              Agent ve tool’lar
            </li>
          </ul>
        </aside>

        <main className="relative flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center justify-between px-6 py-5 lg:justify-end">
            <div className="flex items-center gap-2 lg:hidden">
              <BrandMark compact />
              <strong className="text-sm">SAKUS Yönetim</strong>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={btnGhost}
                aria-label={dark ? "Açık tema" : "Koyu tema"}
                onClick={() => setDark((v) => !v)}
              >
                {dark ? <IconSun /> : <IconMoon />}
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 pb-16">
            <form className="w-full max-w-md" onSubmit={onSubmit}>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">
                Yönetim
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Giriş yap</h2>
              <p className="mt-2 text-sm text-zinc-500">Hatları, sohbetleri ve asistanı buradan yönetirsin.</p>

              <label className="mt-8 block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="admin-password">
                Şifre
              </label>
              <div className="relative mt-1.5">
                <input
                  id="admin-password"
                  className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-4 pr-12 text-zinc-900 outline-none transition-colors focus:border-indigo-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-indigo-400"
                  type={show ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
                  onClick={() => setShow((v) => !v)}
                >
                  {show ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>

              {error && (
                <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !password.trim()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:pointer-events-none disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Spinner />
                    Giriliyor…
                  </>
                ) : (
                  "Giriş yap"
                )}
              </button>

              <Link
                to="/"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <IconBack />
                Siteye dön
              </Link>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <svg className={compact ? "h-9 w-9" : "h-11 w-11"} viewBox="0 0 42 42" aria-hidden>
      <circle cx="21" cy="21" r="21" fill="#06a05a" />
      <path d="M12 24c4-8 14-8 18 0" fill="none" stroke="#c5d100" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11 20c5.5-7 14.5-7 20 0" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="21" cy="16" r="3.2" fill="#0c6cb3" />
    </svg>
  );
}

function RouteArt() {
  return (
    <svg className="h-full w-full" viewBox="0 0 520 720" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path d="M40 80c80 40 120 180 80 280s-20 180 80 240" stroke="#6366f1" strokeOpacity="0.35" strokeWidth="2" />
      <path d="M120 40c40 120 200 80 240 200s40 220 160 280" stroke="#34d399" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M0 360c160-40 200 80 360 40 80-20 140 60 180 120" stroke="#818cf8" strokeOpacity="0.25" strokeWidth="2" />
      <circle cx="120" cy="160" r="5" fill="#818cf8" />
      <circle cx="360" cy="240" r="5" fill="#34d399" />
      <circle cx="200" cy="480" r="5" fill="#818cf8" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.4" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function IconHat() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 16h16M6 16V9l6-4 6 4v7M8 16v3m8-3v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconInbox() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 13h4l2 3h4l2-3h4v6H4v-6Z" strokeLinejoin="round" />
      <path d="M4 13 7 5h10l3 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" strokeLinecap="round" />
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

function IconEye() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2M9.9 5.1A11 11 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3.2 3.8M6.1 6.1C3.9 7.8 2 12 2 12s4 7 10 7c1.3 0 2.5-.3 3.6-.8" strokeLinecap="round" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
