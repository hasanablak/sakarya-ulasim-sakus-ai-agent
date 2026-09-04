import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LLM_SAGLAYICILAR } from "@sakus/shared";
import { api } from "../../api";

const MODEL_VARSAYILAN: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  wiro: "google/gemini-3-7-flash",
};

const TOKEN_PLACEHOLDER: Record<string, string> = {
  openai: "sk-…",
  anthropic: "sk-ant-…",
  google: "AIza…",
  groq: "gsk_…",
  wiro: "Wiro API key (secret .env: WIRO_API_SECRET)",
};

const PROMPT_ORNEK =
  "Sen Sakarya Büyükşehir Belediyesi SAKUS asistanısın. Yolcuya hat, durak, sefer saati ve anlık otobüs konumu konusunda yardımcı olursun. Tool sonuçlarını kısa Türkçe cümlelerle özetle; ham JSON okuma. Konumun yoksa nazikçe iste.";

type ToolOpt = { id: number; ad: string; aciklama: string; aktif: number | boolean };

export function AgentFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const editing = Boolean(id);
  const [toollar, setToollar] = useState<ToolOpt[]>([]);
  const [ad, setAd] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [sistemPrompt, setSistemPrompt] = useState(PROMPT_ORNEK);
  const [saglayici, setSaglayici] = useState("openai");
  const [model, setModel] = useState(MODEL_VARSAYILAN.openai);
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [tokenSon, setTokenSon] = useState<string | null>(null);
  const [aktif, setAktif] = useState(true);
  const [toolIds, setToolIds] = useState<number[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .toollar()
      .then((d) => setToollar(d.toollar ?? []))
      .catch((e) => setErr(String((e as Error).message)));
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .agent(Number(id))
      .then((d) => {
        const a = d.agent;
        setAd(a.ad);
        setAciklama(a.aciklama ?? "");
        setSistemPrompt(a.sistem_prompt);
        setSaglayici(a.llm_saglayici);
        setModel(a.model);
        setHasToken(Boolean(a.has_token));
        setTokenSon(a.token_son);
        setAktif(Boolean(a.aktif));
        setToolIds(a.tool_ids ?? []);
      })
      .catch((e) => setErr(String((e as Error).message)));
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (saglayici === "cursor") {
      setErr("Cursor / Composer kaldırıldı. OpenAI, Claude, Gemini, Groq veya Wiro seç.");
      return;
    }
    try {
      const body = {
        ad,
        aciklama,
        sistem_prompt: sistemPrompt,
        llm_saglayici: saglayici,
        model,
        aktif,
        tool_ids: toolIds,
        ...(token.trim() ? { api_token: token.trim() } : {}),
      };
      const r = await api.agentKaydet(body, id ? Number(id) : undefined);
      setMsg("Kaydedildi.");
      if (!id && r.agent?.id) nav(`/admin/agentler/${r.agent.id}`, { replace: true });
      else {
        setToken("");
        setHasToken(Boolean(r.agent?.has_token));
        setTokenSon(r.agent?.token_son ?? null);
      }
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }

  async function onSil() {
    if (!id || !confirm("Bu agent silinsin mi?")) return;
    try {
      await api.agentSil(Number(id));
      nav("/admin/agentler");
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }

  return (
    <div className="form-page">
      <header className="page-head">
        <div>
          <p className="kicker">
            <Link to="/admin/agentler">Agent'lar</Link>
          </p>
          <h1>{editing ? "Agent düzenle" : "Yeni agent"}</h1>
        </div>
      </header>
      {err && <p className="err">{err}</p>}
      {msg && <p className="note">{msg}</p>}
      <form className="card form-stack" onSubmit={onSubmit}>
        <label>
          Ad
          <input value={ad} onChange={(e) => setAd(e.target.value)} required placeholder="SAKUS yolcu asistanı" />
        </label>
        <label>
          Açıklama
          <input value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Kısa not, admin için" />
        </label>
        <div className="form-grid">
          <label>
            LLM
            <select
              value={saglayici}
              onChange={(e) => {
                const next = e.target.value;
                if (model === MODEL_VARSAYILAN[saglayici] || saglayici === "cursor") {
                  setModel(MODEL_VARSAYILAN[next] ?? model);
                }
                setSaglayici(next);
              }}
            >
              {saglayici === "cursor" && (
                <option value="cursor" disabled>
                  Cursor / Composer (kaldırıldı)
                </option>
              )}
              {LLM_SAGLAYICILAR.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ad}
                </option>
              ))}
            </select>
          </label>
          <label>
            Model
            <input value={model} onChange={(e) => setModel(e.target.value)} required />
          </label>
        </div>
        <label>
          API token
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={
              hasToken
                ? `kayıtlı · …${tokenSon} — boş bırakırsan değişmez`
                : (TOKEN_PLACEHOLDER[saglayici] ?? "API anahtarı")
            }
          />
          {saglayici === "wiro" && (
            <span className="field-hint">
              Wiro imzalı Run API: model `google/gemini-3-7-flash`. API secret tarayıcıya konmaz; kök `.env` dosyasında
              `WIRO_API_SECRET`. Token boşsa `WIRO_API_KEY` kullanılır. OpenAI uyumlu uç yok.
            </span>
          )}
          {saglayici === "cursor" && (
            <span className="field-hint err">
              Cursor / Composer kaldırıldı. OpenAI, Claude, Gemini, Groq veya Wiro seçip kaydet.
            </span>
          )}
        </label>
        <label>
          Sistem prompt
          <textarea rows={10} value={sistemPrompt} onChange={(e) => setSistemPrompt(e.target.value)} required />
        </label>
        <fieldset className="tool-picks">
          <legend>Kullanabileceği tool’lar</legend>
          {toollar.length === 0 && <p className="muted">Önce Tool’lar menüsünden tool ekle.</p>}
          {toollar.map((t) => (
            <label key={t.id} className="check-row">
              <input
                type="checkbox"
                checked={toolIds.includes(t.id)}
                onChange={(e) => {
                  setToolIds((cur) => (e.target.checked ? [...cur, t.id] : cur.filter((x) => x !== t.id)));
                }}
              />
              <span>
                <code>{t.ad}</code>
                <em>{t.aciklama}</em>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="check-row">
          <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
          Aktif
        </label>
        <div className="row">
          <button type="submit">Kaydet</button>
          {editing && (
            <button type="button" className="danger" onClick={onSil}>
              Sil
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
