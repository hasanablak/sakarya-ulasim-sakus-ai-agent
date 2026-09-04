import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";

type FnArg = { name: string; type: string; required: boolean; aciklama: string };
type Fonksiyon = { kod: string; ad: string; aciklama: string; args: FnArg[] };

function ornekArgs(fn: Fonksiyon | undefined): string {
  if (!fn) return "{}";
  const o: Record<string, unknown> = {};
  for (const a of fn.args) {
    if (a.name === "hat") o.hat = "A1";
    else if (a.name === "q") o.q = "";
    else if (a.name === "gun_kod") o.gun_kod = "haftaici";
    else if (a.name === "lat") o.lat = 40.756;
    else if (a.name === "lng") o.lng = 30.378;
    else if (a.name === "yari_cap_m") o.yari_cap_m = 600;
  }
  return JSON.stringify(o, null, 2);
}

export function ToolFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const editing = Boolean(id);
  const [fonksiyonlar, setFonksiyonlar] = useState<Fonksiyon[]>([]);
  const [ad, setAd] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [fonksiyonKod, setFonksiyonKod] = useState("");
  const [aktif, setAktif] = useState(true);
  const [argsText, setArgsText] = useState("{}");
  const [sonuc, setSonuc] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const secili = useMemo(
    () => fonksiyonlar.find((f) => f.kod === fonksiyonKod),
    [fonksiyonlar, fonksiyonKod],
  );

  useEffect(() => {
    api
      .fonksiyonlar()
      .then((d) => {
        const list = (d.fonksiyonlar ?? []) as Fonksiyon[];
        setFonksiyonlar(list);
        if (!id && list[0] && !fonksiyonKod) {
          setFonksiyonKod(list[0].kod);
          setAd(list[0].kod);
          setAciklama(list[0].aciklama);
          setArgsText(ornekArgs(list[0]));
        }
      })
      .catch((e) => setErr(String((e as Error).message)));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api
      .tool(Number(id))
      .then((d) => {
        const t = d.tool;
        setAd(t.ad);
        setAciklama(t.aciklama);
        setFonksiyonKod(t.fonksiyon_kod);
        setAktif(Boolean(t.aktif));
      })
      .catch((e) => setErr(String((e as Error).message)));
  }, [id]);

  useEffect(() => {
    if (secili) setArgsText(ornekArgs(secili));
  }, [secili?.kod]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      const r = await api.toolKaydet(
        { ad, aciklama, fonksiyon_kod: fonksiyonKod, aktif },
        id ? Number(id) : undefined,
      );
      setMsg("Kaydedildi.");
      if (!id && r.tool?.id) nav(`/admin/toollar/${r.tool.id}`, { replace: true });
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }

  async function onSil() {
    if (!id || !confirm("Bu tool silinsin mi? Agent’lardan da kalkar.")) return;
    try {
      await api.toolSil(Number(id));
      nav("/admin/toollar");
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }

  async function dene() {
    if (!fonksiyonKod) return;
    setErr(null);
    setSonuc(null);
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(argsText || "{}") as Record<string, unknown>;
    } catch {
      setErr("Argüman JSON’u geçersiz.");
      return;
    }
    try {
      const r = await api.fonksiyonCalistir(fonksiyonKod, { args, toolAd: ad || fonksiyonKod });
      setSonuc(JSON.stringify(r.result, null, 2));
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }

  return (
    <div className="form-page">
      <header className="page-head">
        <div>
          <p className="kicker">
            <Link to="/admin/toollar">Tool'lar</Link>
          </p>
          <h1>{editing ? "Tool düzenle" : "Yeni tool"}</h1>
        </div>
      </header>
      {err && <p className="err">{err}</p>}
      {msg && <p className="note">{msg}</p>}
      <form className="card form-stack" onSubmit={onSubmit}>
        <label>
          Ad (snake_case)
          <input value={ad} onChange={(e) => setAd(e.target.value)} required placeholder="otobus_saat_sorgula" />
        </label>
        <label>
          Açıklama
          <textarea rows={3} value={aciklama} onChange={(e) => setAciklama(e.target.value)} required />
        </label>
        <label>
          Fonksiyon
          <select
            value={fonksiyonKod}
            onChange={(e) => {
              const kod = e.target.value;
              const fn = fonksiyonlar.find((f) => f.kod === kod);
              setFonksiyonKod(kod);
              if (fn && (!ad || ad === fonksiyonKod)) setAd(fn.kod);
              if (fn && (!aciklama || aciklama === secili?.aciklama)) setAciklama(fn.aciklama);
            }}
            required
          >
            <option value="" disabled>
              Seç
            </option>
            {fonksiyonlar.map((f) => (
              <option key={f.kod} value={f.kod}>
                {f.ad} — {f.kod}
              </option>
            ))}
          </select>
        </label>
        {secili && (
          <p className="muted">
            {secili.aciklama}
            {secili.args.length > 0 && (
              <>
                {" "}
                Argümanlar: {secili.args.map((a) => `${a.name}${a.required ? "" : "?"}`).join(", ")}.
              </>
            )}
          </p>
        )}
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

      <section className="card form-stack" style={{ marginTop: 16 }}>
        <h2>Fonksiyonu dene</h2>
        <p className="muted">LLM’e gitmez; doğrudan veritabanından çalışır.</p>
        <label>
          Argümanlar (JSON)
          <textarea rows={8} value={argsText} onChange={(e) => setArgsText(e.target.value)} />
        </label>
        <button type="button" onClick={() => void dene()} disabled={!fonksiyonKod}>
          Çalıştır
        </button>
        {sonuc && <pre className="json-out">{sonuc}</pre>}
      </section>
    </div>
  );
}
