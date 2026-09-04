import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAdminToken } from "../../api";

export function LoginPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    <div className="login-wrap">
      <form className="card" onSubmit={onSubmit}>
        <h1>Yönetim girişi</h1>
        <p>
          Şifre <strong>admin</strong> — MySQL’deki <code>sakus</code> değil.
        </p>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="admin"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="err">{error}</p>}
        <button type="submit">Giriş</button>
      </form>
    </div>
  );
}
