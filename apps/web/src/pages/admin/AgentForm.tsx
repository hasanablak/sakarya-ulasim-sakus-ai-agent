import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LLM_SAGLAYICILAR } from "@sakus/shared";
import { api } from "../../api";
import {
  btnDanger,
  btnPrimary,
  cardCls,
  checkInput,
  checkRow,
  cx,
  errText,
  inputCls,
  labelCls,
  linkCls,
  muted,
  pageHead,
  pageTitle,
} from "./ui";

const MODEL_VARSAYILAN: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "openai/gpt-4o-mini",
};

const TOKEN_PLACEHOLDER: Record<string, string> = {
  openai: "sk-…",
  anthropic: "sk-ant-…",
  google: "AIza…",
  groq: "gsk_…",
  openrouter: "sk-or-v1-…",
};

const PROMPT_ORNEK =
  "Sen Sakarya Büyükşehir Belediyesi SAKUS asistanısın. Yolcuya hat, durak, sefer saati ve anlık otobüs konumu konusunda yardımcı olursun. Tool sonuçlarını kısa Türkçe cümlelerle özetle; ham JSON okuma. Konumun yoksa nazikçe iste. Sakarya’da “Çarşı” Adapazarı merkez demektir.";

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
    if (saglayici === "cursor" || saglayici === "wiro") {
      setErr("Bu sağlayıcı kaldırıldı. OpenAI, Claude, Gemini, Groq veya OpenRouter seç.");
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className={pageHead}>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            <Link className={linkCls} to="/admin/agentler">
              Agent'lar
            </Link>
          </p>
          <h1 className={pageTitle}>{editing ? "Agent düzenle" : "Yeni agent"}</h1>
        </div>
      </header>
      {err && <p className={errText}>{err}</p>}
      {msg && <p className="text-sm text-emerald-500">{msg}</p>}
      <form className={cx(cardCls, "flex flex-col gap-4")} onSubmit={onSubmit}>
        <label className={labelCls}>
          Ad
          <input className={inputCls} value={ad} onChange={(e) => setAd(e.target.value)} required placeholder="SAKUS yolcu asistanı" />
        </label>
        <label className={labelCls}>
          Açıklama
          <input className={inputCls} value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="Kısa not, admin için" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            LLM
            <select
              className={inputCls}
              value={saglayici}
              onChange={(e) => {
                const next = e.target.value;
                if (model === MODEL_VARSAYILAN[saglayici] || saglayici === "cursor" || saglayici === "wiro") {
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
              {saglayici === "wiro" && (
                <option value="wiro" disabled>
                  Wiro (kaldırıldı)
                </option>
              )}
              {LLM_SAGLAYICILAR.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ad}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Model
            <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} required />
          </label>
        </div>
        <label className={labelCls}>
          API token
          <input
            className={inputCls}
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
          {saglayici === "openrouter" && (
            <span className="text-xs leading-snug text-zinc-500">
              OpenRouter OpenAI uyumlu uç. Model id `sağlayıcı/model` (ör. `openai/gpt-4o-mini`,
              `google/gemini-2.5-flash`). Anahtar: openrouter.ai/keys (`sk-or-v1-…`).
            </span>
          )}
          {(saglayici === "cursor" || saglayici === "wiro") && (
            <span className="text-xs leading-snug text-red-500">
              {saglayici === "wiro" ? "Wiro" : "Cursor / Composer"} kaldırıldı. OpenAI, Claude, Gemini, Groq veya
              OpenRouter seçip kaydet.
            </span>
          )}
        </label>
        <label className={labelCls}>
          Sistem prompt
          <textarea className={inputCls} rows={10} value={sistemPrompt} onChange={(e) => setSistemPrompt(e.target.value)} required />
        </label>
        <fieldset className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <legend className="px-1.5 text-sm text-zinc-500">Kullanabileceği tool’lar</legend>
          {toollar.length === 0 && <p className={muted}>Önce Tool’lar menüsünden tool ekle.</p>}
          {toollar.map((t) => (
            <label key={t.id} className={cx(checkRow, "py-1")}>
              <input
                className={checkInput}
                type="checkbox"
                checked={toolIds.includes(t.id)}
                onChange={(e) => {
                  setToolIds((cur) => (e.target.checked ? [...cur, t.id] : cur.filter((x) => x !== t.id)));
                }}
              />
              <span>
                <code className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{t.ad}</code>
                <em className="block text-xs not-italic text-zinc-500">{t.aciklama}</em>
              </span>
            </label>
          ))}
        </fieldset>
        <label className={checkRow}>
          <input className={checkInput} type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
          Aktif
        </label>
        <div className="flex items-center gap-2">
          <button type="submit" className={btnPrimary}>
            Kaydet
          </button>
          {editing && (
            <button type="button" className={btnDanger} onClick={onSil}>
              Sil
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
