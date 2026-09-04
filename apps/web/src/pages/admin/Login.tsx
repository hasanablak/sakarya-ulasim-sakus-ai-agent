import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAdminToken } from "../../api";
import { btnGhost, btnPrimary, cardCls, cx, errText, inputCls, pageSub, pageTitle, readAdminDark, writeAdminDark } from "./ui";

export function LoginPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(readAdminDark);

  useEffect(() => {
    writeAdminDark(dark);
  }, [dark]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const data = await api.adminLogin(password);
      setAdminToken(data.token);
      nav("/admin");
    } catch (err) {
      setError(String((err as Error).message));
    }
  }

  return (
    <div className={cx(dark && "dark")}>
      <div className="grid min-h-screen place-items-center bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <button
          type="button"
          className={cx(btnGhost, "absolute right-6 top-5")}
          aria-label={dark ? "Açık tema" : "Koyu tema"}
          onClick={() => setDark((v) => !v)}
        >
          {dark ? "Açık" : "Koyu"}
        </button>
        <form className={cx(cardCls, "w-[min(380px,92vw)]")} onSubmit={onSubmit}>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">S</span>
            <h1 className={pageTitle}>Yönetim girişi</h1>
          </div>
          <p className={cx(pageSub, "mb-4")}>
            Şifre <strong className="text-zinc-900 dark:text-zinc-50">admin</strong> — MySQL’deki <code className="font-mono text-xs">sakus</code> değil.
          </p>
          <input
            className={inputCls}
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="admin"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className={cx(errText, "mt-3 text-sm")}>{error}</p>}
          <button type="submit" className={cx(btnPrimary, "mt-4 w-full")}>
            Giriş
          </button>
        </form>
      </div>
    </div>
  );
}
