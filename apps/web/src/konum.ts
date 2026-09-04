export type Konum = { lat: number; lng: number };
export type KonumNeden = "destek_yok" | "reddedildi" | "zaman_asimi" | "hata";
export type KonumSonuc = { ok: true; konum: Konum } | { ok: false; neden: KonumNeden };

const CACHE_KEY = "sakus_son_konum";
const TIMEOUT_MS = 15_000;
const CACHE_MS = 5 * 60_000;

let inflight: Promise<KonumSonuc> | null = null;

function cacheOku(): Konum | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { lat?: unknown; lng?: unknown; t?: unknown };
    if (typeof o.lat !== "number" || typeof o.lng !== "number") return null;
    if (typeof o.t === "number" && Date.now() - o.t > CACHE_MS) return null;
    return { lat: o.lat, lng: o.lng };
  } catch {
    return null;
  }
}

function cacheYaz(k: Konum) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...k, t: Date.now() }));
  } catch {
    /* gizli tarama */
  }
}

export function konumAl(timeoutMs = TIMEOUT_MS): Promise<KonumSonuc> {
  if (!navigator.geolocation) return Promise.resolve({ ok: false, neden: "destek_yok" });
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: KonumSonuc) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const timer = window.setTimeout(() => finish({ ok: false, neden: "zaman_asimi" }), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        window.clearTimeout(timer);
        finish({ ok: true, konum: { lat: p.coords.latitude, lng: p.coords.longitude } });
      },
      (err) => {
        window.clearTimeout(timer);
        if (err.code === 1) finish({ ok: false, neden: "reddedildi" });
        else if (err.code === 3) finish({ ok: false, neden: "zaman_asimi" });
        else finish({ ok: false, neden: "hata" });
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 120_000 },
    );
  });
}

/** Tıklama jestinde çağır; izin penceresi jest kaybolmadan açılsın. */
export function baslatKonumIstegi(): Promise<KonumSonuc> {
  const cached = cacheOku();
  if (cached) return Promise.resolve({ ok: true, konum: cached });
  if (inflight) return inflight;
  inflight = konumAl().then((r) => {
    inflight = null;
    if (r.ok) cacheYaz(r.konum);
    return r;
  });
  return inflight;
}

export function konumHint(neden: KonumNeden): string {
  if (neden === "reddedildi") {
    return "Konum izni kapalı. Adres çubuğundaki kilitten konum iznini aç, sonra aynı soruyu tekrar yaz.";
  }
  if (neden === "zaman_asimi") {
    return "Konum alınamadı (zaman doldu). İzin penceresini onaylayıp tekrar dene.";
  }
  if (neden === "destek_yok") {
    return "Bu tarayıcı konum paylaşmıyor. En yakın durağı yazabilirsin.";
  }
  return "Konum alınamadı. İzni kontrol edip tekrar dene.";
}
