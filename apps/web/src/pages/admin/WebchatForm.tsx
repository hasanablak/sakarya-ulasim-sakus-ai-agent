import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DEFAULT_WEBCHAT_TEMA, mergeWebchatTema, type WebchatKonum, type WebchatPublic, type WebchatTema } from "@sakus/shared";
import { api } from "../../api";
import { ChatShell } from "../../components/ChatShell";
import { ORNEK_CUMLELER } from "../../components/ChatWidget";
import { EmbedSnippet } from "../../components/EmbedSnippet";
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

type AgentOpt = { id: number; ad: string; aktif: boolean };

const COLOR_FIELDS: { key: Exclude<keyof WebchatTema, "panel_width">; label: string }[] = [
  { key: "header_bg", label: "Başlık zemin" },
  { key: "header_fg", label: "Başlık yazı" },
  { key: "fab_bg", label: "Buton zemin" },
  { key: "fab_fg", label: "Buton yazı" },
  { key: "panel_bg", label: "Panel zemin" },
  { key: "border", label: "Kenarlık" },
  { key: "user_bg", label: "Senin balon" },
  { key: "user_fg", label: "Senin yazı" },
  { key: "bot_bg", label: "Asistan balon" },
  { key: "bot_fg", label: "Asistan yazı" },
];

export function WebchatFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const editing = Boolean(id);
  const [agentler, setAgentler] = useState<AgentOpt[]>([]);
  const [ad, setAd] = useState("Ana site");
  const [slug, setSlug] = useState("public");
  const [agentId, setAgentId] = useState<number | "">("");
  const [baslik, setBaslik] = useState("SAKUS sohbet");
  const [karsilama, setKarsilama] = useState("Hat kodu yaz (ör. A1) veya “nasıl çalışır?” diye sor.");
  const [placeholder, setPlaceholder] = useState("Mesaj yaz…");
  const [fabAc, setFabAc] = useState("Sohbet");
  const [fabKapat, setFabKapat] = useState("Kapat");
  const [konum, setKonum] = useState<WebchatKonum>("sag_alt");
  const [tema, setTema] = useState<WebchatTema>({ ...DEFAULT_WEBCHAT_TEMA });
  const [aktif, setAktif] = useState(true);
  const [varsayilan, setVarsayilan] = useState(true);
  const [embedKey, setEmbedKey] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .agentler()
      .then((d) => setAgentler(d.agentler ?? []))
      .catch((e) => setErr(String((e as Error).message)));
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .webchatGet(Number(id))
      .then((d) => {
        const w = d.webchat as WebchatPublic;
        setAd(w.ad);
        setSlug(w.slug);
        setAgentId(w.agent_id ?? "");
        setBaslik(w.baslik);
        setKarsilama(w.karsilama);
        setPlaceholder(w.placeholder);
        setFabAc(w.fab_ac);
        setFabKapat(w.fab_kapat);
        setKonum(w.konum);
        setTema(mergeWebchatTema(w.tema));
        setAktif(w.aktif);
        setVarsayilan(w.varsayilan);
        setEmbedKey(w.embed_key);
      })
      .catch((e) => setErr(String((e as Error).message)));
  }, [id]);

  const live: WebchatPublic = useMemo(
    () => ({
      id: id ? Number(id) : 0,
      embed_key: embedKey ?? "",
      slug,
      ad,
      agent_id: agentId === "" ? null : Number(agentId),
      agent_ad: agentler.find((a) => a.id === agentId)?.ad ?? null,
      baslik,
      karsilama,
      placeholder,
      fab_ac: fabAc,
      fab_kapat: fabKapat,
      konum,
      tema,
      aktif,
      varsayilan,
    }),
    [id, embedKey, slug, ad, agentId, agentler, baslik, karsilama, placeholder, fabAc, fabKapat, konum, tema, aktif, varsayilan],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      const r = await api.webchatKaydet(
        {
          ad,
          slug,
          agent_id: agentId === "" ? null : Number(agentId),
          baslik,
          karsilama,
          placeholder,
          fab_ac: fabAc,
          fab_kapat: fabKapat,
          konum,
          tema,
          aktif,
          varsayilan,
        },
        id ? Number(id) : undefined,
      );
      setMsg("Kaydedildi. Ana sitedeki sohbet bu tasarıma göre güncellenir.");
      if (r.webchat?.embed_key) setEmbedKey(r.webchat.embed_key);
      if (!id && r.webchat?.id) nav(`/admin/webchatler/${r.webchat.id}`, { replace: true });
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }

  async function onSil() {
    if (!id || !confirm("Bu webchat silinsin mi?")) return;
    try {
      await api.webchatSil(Number(id));
      nav("/admin/webchatler");
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className={pageHead}>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            <Link className={linkCls} to="/admin/webchatler">
              Webchat'ler
            </Link>
          </p>
          <h1 className={pageTitle}>{editing ? "Webchat düzenle" : "Yeni webchat"}</h1>
        </div>
      </header>
      {err && <p className={errText}>{err}</p>}
      {msg && <p className="text-sm text-emerald-500">{msg}</p>}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="flex flex-col gap-6">
        <form className={cx(cardCls, "flex flex-col gap-4")} onSubmit={onSubmit}>
          <label className={labelCls}>
            Ad
            <input className={inputCls} value={ad} onChange={(e) => setAd(e.target.value)} required />
          </label>
          <label className={labelCls}>
            Slug
            <input className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="public" />
          </label>
          <label className={labelCls}>
            Agent
            <select className={inputCls} value={agentId} onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Agent seçilmedi</option>
              {agentler.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ad}
                  {a.aktif ? "" : " (pasif)"}
                </option>
              ))}
            </select>
          </label>
          <p className={muted}>Sohbet döngüsü bağlanınca bu agent’ın prompt’u, LLM’i ve tool’ları kullanılacak.</p>
          <label className={labelCls}>
            Pencere başlığı
            <input className={inputCls} value={baslik} onChange={(e) => setBaslik(e.target.value)} required />
          </label>
          <label className={labelCls}>
            Karşılama
            <textarea className={inputCls} rows={3} value={karsilama} onChange={(e) => setKarsilama(e.target.value)} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Placeholder
              <input className={inputCls} value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} />
            </label>
            <label className={labelCls}>
              Konum
              <select className={inputCls} value={konum} onChange={(e) => setKonum(e.target.value as WebchatKonum)}>
                <option value="sag_alt">Sağ alt</option>
                <option value="sol_alt">Sol alt</option>
              </select>
            </label>
            <label className={labelCls}>
              Açık buton
              <input className={inputCls} value={fabAc} onChange={(e) => setFabAc(e.target.value)} />
            </label>
            <label className={labelCls}>
              Kapalı buton
              <input className={inputCls} value={fabKapat} onChange={(e) => setFabKapat(e.target.value)} />
            </label>
          </div>
          <label className={labelCls}>
            Panel genişliği ({tema.panel_width}px)
            <input
              className="w-full accent-indigo-600"
              type="range"
              min={280}
              max={480}
              value={tema.panel_width}
              onChange={(e) => setTema((t) => ({ ...t, panel_width: Number(e.target.value) }))}
            />
          </label>
          <fieldset className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <legend className="px-1.5 text-sm text-zinc-500">Renkler</legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {COLOR_FIELDS.map((f) => (
                <label key={f.key} className={labelCls}>
                  {f.label}
                  <span className="flex items-center gap-2">
                    <input
                      className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(tema[f.key]) ? tema[f.key] : "#000000"}
                      onChange={(e) => setTema((t) => ({ ...t, [f.key]: e.target.value }))}
                    />
                    <input
                      className={inputCls}
                      value={tema[f.key]}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setTema((t) => ({ ...t, [f.key]: v }));
                      }}
                      onBlur={() => setTema((t) => mergeWebchatTema(t))}
                    />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className={checkRow}>
            <input className={checkInput} type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
            Aktif
          </label>
          <label className={checkRow}>
            <input className={checkInput} type="checkbox" checked={varsayilan} onChange={(e) => setVarsayilan(e.target.checked)} />
            Ana sitede göster (varsayılan)
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
        <EmbedSnippet embedKey={embedKey} />
        </div>
        <div className="relative sticky top-20 h-[560px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
          <p className="absolute left-3.5 top-3 z-2 m-0 text-xs uppercase tracking-wide text-zinc-500">Önizleme</p>
          <ChatShell
            cfg={live}
            open={previewOpen}
            onToggle={() => setPreviewOpen((v) => !v)}
            preview
            composer={
              <div className="chat-composer">
                <div className="chat-suggest">
                  {ORNEK_CUMLELER.map((cumle) => (
                    <button key={cumle} type="button">
                      {cumle}
                    </button>
                  ))}
                </div>
                <form onSubmit={(e) => e.preventDefault()}>
                  <input placeholder={placeholder} readOnly />
                  <button type="button">Gönder</button>
                </form>
              </div>
            }
          >
            <p className="hint">{karsilama}</p>
            <div className="bubble assistant">Merhaba, bir hat kodu yazabilirsin — örneğin A1.</div>
            <div className="bubble user">A1 nerede?</div>
          </ChatShell>
        </div>
      </div>
    </div>
  );
}
