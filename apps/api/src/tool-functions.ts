import type { RowDataPacket } from "mysql2";
import { exec, query } from "./db.js";
import { getHatBySlug, hatSearchClause, listHatlar, liveSlugs, startLive } from "./jobs.js";
import { oturumKonumu } from "./chat-store.js";
import { eslesenYer, type YerKayit } from "./yer-sozlugu.js";

export type ToolArg = {
  name: string;
  type: "string" | "number";
  required: boolean;
  aciklama: string;
};

export type FonksiyonTanim = {
  kod: string;
  ad: string;
  aciklama: string;
  args: ToolArg[];
};

export type FnResult = { ok: boolean; data?: unknown; error?: string; stale?: boolean };

export const FONKSIYONLAR: FonksiyonTanim[] = [
  {
    kod: "otobus_sorgula",
    ad: "Otobüs sorgula",
    aciklama: "Kayıtlı hatların özetini toplu döner. q bir yer adıysa (Çarşı, Orta Garaj) o dairenin içinden geçen hatları da ekler.",
    args: [{ name: "q", type: "string", required: false, aciklama: "Kod, ad, slug veya yer; Çarşı = Adapazarı merkez" }],
  },
  {
    kod: "otobus_guzergah_sorgula",
    ad: "Otobüs güzergahları sorgula",
    aciklama: "Hat verilirse durak sırası; verilmezse tüm hatların yön özeti (baş-son durak).",
    args: [{ name: "hat", type: "string", required: false, aciklama: "Hat kodu veya slug; boşsa özet" }],
  },
  {
    kod: "otobus_anlik_konum_sorgula",
    ad: "Otobüs anlık konum sorgula",
    aciklama:
      "Bir hattın otobüslerini yolcu dilinde döner (yön, sonraki durak, durakta mı). Plaka ve koordinat yok. Kayıt yoksa API kısa bekler; konum uydurma.",
    args: [{ name: "hat", type: "string", required: true, aciklama: "Hat kodu veya slug" }],
  },
  {
    kod: "otobus_saat_sorgula",
    ad: "Otobüs saat sorgula",
    aciklama:
      "Hattın hareket saatleri. Türkiye saatine göre her yön için sonraki seferi ve kalan dakikayı da döner. gun_kod: haftaici, cumartesi, pazar.",
    args: [
      { name: "hat", type: "string", required: true, aciklama: "Hat kodu veya slug" },
      { name: "gun_kod", type: "string", required: false, aciklama: "haftaici | cumartesi | pazar" },
    ],
  },
  {
    kod: "yakin_duraklar",
    ad: "Yakın duraklar",
    aciklama:
      "Kullanıcının tarayıcı konumuna en yakın duraklar ve geçen hatlar. lat/lng uydurma; sunucu oturumdan doldurur. Varsayılan yürüme 600 m.",
    args: [
      { name: "lat", type: "number", required: false, aciklama: "Boş bırak; oturum konumu kullanılır" },
      { name: "lng", type: "number", required: false, aciklama: "Boş bırak; oturum konumu kullanılır" },
      { name: "yari_cap_m", type: "number", required: false, aciklama: "Metre, varsayılan 600" },
    ],
  },
  {
    kod: "yerden_gecen_hatlar",
    ad: "Yerden geçen hatlar",
    aciklama:
      "Sakarya yer adı (Çarşı = Adapazarı merkez, Orta Garaj) için o noktanın yürüme dairesindeki duraklara uğrayan hatlar. Hat adında yer geçmek zorunda değildir. Konum varken “nasıl giderim” için rota_oneri kullan.",
    args: [{ name: "yer", type: "string", required: true, aciklama: "çarşı, adapazarı merkez, orta garaj, o. garaj" }],
  },
  {
    kod: "rota_oneri",
    ad: "Rota öner",
    aciklama:
      "“X’e nasıl giderim?” için: yakın duraklardan geçen hatlar ∩ hedef dairesinden geçen hatlar. Çarşı = Adapazarı merkez. lat/lng uydurma. Canlı araç varsa yolcu cümlesi ekler.",
    args: [
      { name: "hedef", type: "string", required: true, aciklama: "çarşı, adapazarı merkez, orta garaj, o. garaj" },
      { name: "lat", type: "number", required: false, aciklama: "Boş bırak; oturum konumu kullanılır" },
      { name: "lng", type: "number", required: false, aciklama: "Boş bırak; oturum konumu kullanılır" },
      { name: "yari_cap_m", type: "number", required: false, aciklama: "Yürüme metre, varsayılan 600" },
    ],
  },
];

const STALE_MS = 30_000;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

const KONUM_KODLARI = new Set(["yakin_duraklar", "rota_oneri"]);

function konumYok(): FnResult {
  return {
    ok: false,
    error: "konum yok. Kullanıcıdan tarayıcı konum izni iste, sonra aynı soruyu tekrar yazmasını söyle.",
    data: { konum_gerekli: true },
  };
}

type GunKod = "haftaici" | "cumartesi" | "pazar";

function gunKodFromWd(wd: string): GunKod {
  if (wd === "Sat") return "cumartesi";
  if (wd === "Sun") return "pazar";
  return "haftaici";
}

function istanbulSaat() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = Number(g("year"));
  const mo = Number(g("month"));
  const d = Number(g("day"));
  const yarin = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(Date.UTC(y, mo - 1, d + 1, 12)));
  const yg = (t: string) => yarin.find((p) => p.type === t)?.value ?? "";
  return {
    saat: `${g("hour")}:${g("minute")}`,
    tarih: `${g("year")}-${g("month")}-${g("day")}`,
    gunKod: gunKodFromWd(g("weekday")),
    yarinGunKod: gunKodFromWd(yg("weekday")),
    yarinTarih: `${yg("year")}-${yg("month")}-${yg("day")}`,
  };
}

function todayGunKod(): GunKod {
  return istanbulSaat().gunKod;
}

function fmtSaat(raw: unknown): string {
  return String(raw ?? "").slice(0, 5);
}

function saatDakika(raw: string): number {
  const [h, m] = fmtSaat(raw).split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function staleOf(updatedAt: Date | string | null): boolean {
  if (!updatedAt) return true;
  const t = new Date(updatedAt).getTime();
  return Number.isNaN(t) || Date.now() - t > STALE_MS;
}

/** ~80 m ≈ 1 dk yürüyüş; yolcuya metre okutmamak için. */
function yurumeDk(m: number): number {
  if (!Number.isFinite(m) || m <= 0) return 1;
  return Math.max(1, Math.round(m / 80));
}

async function resolveHat(ref: string) {
  const raw = ref.trim();
  if (!raw) return undefined;
  const exact = await getHatBySlug(raw);
  if (exact) return exact;
  const list = await listHatlar(raw);
  return list[0];
}

async function otobusSorgula(args: Record<string, unknown>): Promise<FnResult> {
  const q = str(args.q) || undefined;
  const yer = q ? eslesenYer(q) : null;
  if (yer?.merkez && yer.yari_cap_m) {
    return yerdenGecenHatlar({ yer: yer.soz });
  }
  const filtre = q ? hatSearchClause(q, "h") : { sql: "", params: [] as string[] };
  const ozet = await query<RowDataPacket[]>(
    `SELECT h.id, h.kod, h.slug, h.ad, h.bus_type_name, h.last_ingested_at,
            (SELECT COUNT(DISTINCT hd.durak_id) FROM hat_duraklari hd WHERE hd.hat_id = h.id) AS durak_sayisi,
            (SELECT COUNT(*) FROM hat_seferleri s WHERE s.hat_id = h.id) AS sefer_sayisi,
            (SELECT COUNT(*) FROM arac_son_konum a WHERE a.hat_id = h.id) AS arac_sayisi
     FROM hatlar h
     ${filtre.sql ? `WHERE ${filtre.sql}` : ""}
     ORDER BY h.kod`,
    filtre.params,
  );
  return {
    ok: true,
    data: {
      adet: ozet.length,
      hatlar: ozet.map((h) => ({
        kod: h.kod,
        slug: h.slug,
        ad: h.ad,
        tur: h.bus_type_name,
        durak: Number(h.durak_sayisi),
        sefer: Number(h.sefer_sayisi),
        arac: Number(h.arac_sayisi),
      })),
    },
  };
}

async function otobusGuzergahSorgula(args: Record<string, unknown>): Promise<FnResult> {
  const hatRef = str(args.hat);
  if (hatRef) {
    const hat = await resolveHat(hatRef);
    if (!hat) return { ok: false, error: `hat bulunamadı: ${hatRef}` };
    const stops = await query<RowDataPacket[]>(
      `SELECT hd.sakus_route_id, g.yon_ad, hd.sira, d.ad, d.lat, d.lng
       FROM hat_duraklari hd
       JOIN duraklar d ON d.id = hd.durak_id
       JOIN hat_guzergah g ON g.hat_id = hd.hat_id AND g.sakus_route_id = hd.sakus_route_id
       WHERE hd.hat_id = ?
       ORDER BY hd.sakus_route_id, hd.sira`,
      [hat.id],
    );
    const byRoute = new Map<number, { yon: string; duraklar: { sira: number; ad: string }[] }>();
    for (const s of stops) {
      const id = Number(s.sakus_route_id);
      if (!byRoute.has(id)) byRoute.set(id, { yon: String(s.yon_ad), duraklar: [] });
      byRoute.get(id)!.duraklar.push({
        sira: Number(s.sira),
        ad: String(s.ad),
      });
    }
    return {
      ok: true,
      data: {
        hat: { kod: hat.kod, ad: hat.ad, slug: hat.slug },
        yonler: [...byRoute.entries()].map(([id, v]) => ({ routeId: id, yon: v.yon, duraklar: v.duraklar })),
      },
    };
  }

  const rows = await query<RowDataPacket[]>(
    `SELECT h.kod, h.ad, h.slug, g.sakus_route_id, g.yon_ad, g.start_location, g.end_location,
            (SELECT COUNT(*) FROM hat_duraklari hd WHERE hd.hat_id = g.hat_id AND hd.sakus_route_id = g.sakus_route_id) AS durak
     FROM hat_guzergah g
     JOIN hatlar h ON h.id = g.hat_id
     ORDER BY h.kod, g.sakus_route_id`,
  );
  return {
    ok: true,
    data: {
      adet: rows.length,
      not: "Tüm hat özeti. Tam durak listesi için hat parametresi ver.",
      guzergahlar: rows.map((r) => ({
        kod: r.kod,
        ad: r.ad,
        yon: r.yon_ad,
        bas: r.start_location,
        son: r.end_location,
        durak: Number(r.durak),
      })),
    },
  };
}

async function hatAraclari(hatId: number) {
  return query<RowDataPacket[]>(
    `SELECT bus_number, plate, lat, lng, speed, heading, status, route_name, next_stop_name, at_stop_name, updated_at
     FROM arac_son_konum WHERE hat_id = ? ORDER BY updated_at DESC`,
    [hatId],
  );
}

function mapArac(v: RowDataPacket) {
  const hiz = v.speed != null ? Number(v.speed) : null;
  const durakta = v.at_stop_name ? String(v.at_stop_name) : null;
  const sonraki = v.next_stop_name ? String(v.next_stop_name) : null;
  const guzergah = v.route_name ? String(v.route_name) : null;
  const kod = String(v.status ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  const guzergahDisi = kod === "OFF_ROUTE" || kod === "OUT_OF_ROUTE";
  const hareket = hiz != null && hiz < 1 ? "duruyor" : hiz != null ? "yolda" : null;

  const parca: string[] = [];
  if (guzergah) parca.push(`${guzergah} yönünde`);
  if (durakta) parca.push(`${durakta} durağında`);
  else if (sonraki) parca.push(`sonraki durak ${sonraki}`);
  else if (guzergahDisi) parca.push("haritada net durak görünmüyor");
  if (hareket === "duruyor") parca.push("şu an duruyor");
  else if (hareket === "yolda") parca.push("hareket halinde");

  return {
    guzergah,
    sonraki_durak: sonraki,
    durakta,
    hareket,
    cumle: parca.length ? `${parca.join(", ")}.` : "Konum alındı ama durak adı yok.",
  };
}

function tazeAracVar(vehicles: RowDataPacket[]): boolean {
  return vehicles.some((v) => !staleOf((v.updated_at as Date | string | null) ?? null));
}

async function hatAraclariBekle(hatId: number, ms: number): Promise<RowDataPacket[]> {
  const t0 = Date.now();
  let vehicles = await hatAraclari(hatId);
  while (Date.now() - t0 < ms) {
    if (tazeAracVar(vehicles)) return vehicles;
    await new Promise((r) => setTimeout(r, 800));
    vehicles = await hatAraclari(hatId);
  }
  return vehicles;
}

async function otobusAnlikKonum(args: Record<string, unknown>): Promise<FnResult> {
  const hatRef = str(args.hat);
  if (!hatRef) return { ok: false, error: "hat gerekli" };
  const hat = await resolveHat(hatRef);
  if (!hat) return { ok: false, error: `hat bulunamadı: ${hatRef}` };

  let vehicles = await hatAraclari(hat.id);
  let takip = (await liveSlugs()).includes(hat.slug);
  let takipHata: string | null = null;

  if (!tazeAracVar(vehicles)) {
    try {
      if (!takip) {
        await startLive(hat.slug);
        takip = true;
      }
      vehicles = await hatAraclariBekle(hat.id, 16_000);
    } catch (e) {
      takipHata = e instanceof Error ? e.message : String(e);
      takip = false;
    }
  }

  const latest = vehicles[0]?.updated_at as Date | undefined;
  const stale = staleOf(latest ?? null);
  const arac = vehicles.map(mapArac);
  let uyari: string | null = null;
  if (takipHata || !vehicles.length) uyari = "Şu an haritada bu hatta otobüs görünmüyor; sefer dışı olabilir.";
  else if (stale) uyari = "Konum biraz eski olabilir.";

  return {
    ok: true,
    stale,
    data: {
      hat: { kod: hat.kod, ad: hat.ad },
      arac,
      yolcuya: arac.length ? arac.map((a) => a.cumle).join(" ") : uyari,
      uyari,
    },
  };
}

type SeferSatir = { kalkis: string; varis: string | null; sefer: number | null };

async function hatSeferleri(hatId: number, gun: string): Promise<Map<string, SeferSatir[]>> {
  const rows = await query<RowDataPacket[]>(
    `SELECT sakus_route_id, yon_ad, gun_kod, sefer_no, kalkis, varis
     FROM hat_seferleri WHERE hat_id = ? AND gun_kod = ?
     ORDER BY sakus_route_id, kalkis`,
    [hatId, gun],
  );
  const byYon = new Map<string, SeferSatir[]>();
  for (const r of rows) {
    const yon = String(r.yon_ad);
    if (!byYon.has(yon)) byYon.set(yon, []);
    byYon.get(yon)!.push({
      kalkis: fmtSaat(r.kalkis),
      varis: r.varis != null ? fmtSaat(r.varis) : null,
      sefer: r.sefer_no != null ? Number(r.sefer_no) : null,
    });
  }
  return byYon;
}

async function otobusSaatSorgula(args: Record<string, unknown>): Promise<FnResult> {
  const hatRef = str(args.hat);
  if (!hatRef) return { ok: false, error: "hat gerekli" };
  const hat = await resolveHat(hatRef);
  if (!hat) return { ok: false, error: `hat bulunamadı: ${hatRef}` };
  const saat = istanbulSaat();
  const gun = (str(args.gun_kod) as GunKod) || saat.gunKod;
  const byYon = await hatSeferleri(hat.id, gun);
  const ayniGun = gun === saat.gunKod;
  const simdiDk = saatDakika(saat.saat);
  const yarinByYon = ayniGun ? await hatSeferleri(hat.id, saat.yarinGunKod) : null;

  const yonler = [...byYon.entries()].map(([yon, seferler]) => {
    const yaklasan = ayniGun ? seferler.filter((s) => saatDakika(s.kalkis) >= simdiDk) : seferler;
    const sonrakiBugun = yaklasan[0] ?? null;
    const yarinIlk = !sonrakiBugun && yarinByYon ? (yarinByYon.get(yon)?.[0] ?? null) : null;
    const sonraki = sonrakiBugun
      ? { ...sonrakiBugun, gun: "bugun" as const, kalan_dk: saatDakika(sonrakiBugun.kalkis) - simdiDk }
      : yarinIlk
        ? { ...yarinIlk, gun: "yarin" as const, gun_kod: saat.yarinGunKod, tarih: saat.yarinTarih, kalan_dk: null }
        : null;
    return {
      yon,
      sonraki,
      yaklasan: yaklasan.slice(0, 6),
      sefer_sayisi: seferler.length,
      seferler,
    };
  });

  const seferYok = yonler.every((y) => y.sefer_sayisi === 0);
  return {
    ok: true,
    data: {
      hat: { kod: hat.kod, ad: hat.ad, slug: hat.slug },
      simdi: saat.saat,
      tarih: saat.tarih,
      gun_kod: gun,
      yonler,
      uyari: seferYok
        ? "Bu gün için sefer yok veya saatler henüz çekilmedi."
        : "en yakın = sonraki (şu andan sonra). bugün bittiyse gun=yarin.",
    },
  };
}

async function yerdenGecenHatlar(args: Record<string, unknown>): Promise<FnResult> {
  const raw = str(args.yer) || str(args.q);
  const yer = eslesenYer(raw);
  if (!yer?.merkez || !yer.yari_cap_m) {
    return {
      ok: false,
      error: "bilinen yer yok. şimdilik: çarşı, adapazarı merkez, orta garaj, o. garaj",
    };
  }
  return hatlarDairede(yer);
}

async function hatlarDairede(yer: YerKayit): Promise<FnResult> {
  const { lat, lng } = yer.merkez!;
  const cap = yer.yari_cap_m!;
  const hatlar = await query<RowDataPacket[]>(
    `SELECT h.kod, h.slug, h.ad, h.bus_type_name,
            COUNT(DISTINCT d.id) AS merkez_durak,
            MIN(ST_Distance_Sphere(POINT(d.lng, d.lat), POINT(?, ?))) AS min_m
     FROM hatlar h
     JOIN hat_duraklari hd ON hd.hat_id = h.id
     JOIN duraklar d ON d.id = hd.durak_id
     WHERE ST_Distance_Sphere(POINT(d.lng, d.lat), POINT(?, ?)) <= ?
     GROUP BY h.id, h.kod, h.slug, h.ad, h.bus_type_name
     ORDER BY merkez_durak DESC, min_m
     LIMIT 80`,
    [lng, lat, lng, lat, cap],
  );
  const duraklar = await query<RowDataPacket[]>(
    `SELECT d.ad, MIN(ST_Distance_Sphere(POINT(d.lng, d.lat), POINT(?, ?))) AS min_m
     FROM duraklar d
     WHERE ST_Distance_Sphere(POINT(d.lng, d.lat), POINT(?, ?)) <= ?
     GROUP BY d.ad
     ORDER BY min_m
     LIMIT 8`,
    [lng, lat, lng, lat, cap],
  );
  return {
    ok: true,
    data: {
      yer: { soz: yer.soz, anlam: yer.anlam, yari_cap_m: cap },
      adet: hatlar.length,
      not: "Bu dairenin içindeki duraklara uğrayan hatlar. Yolcuya hepsini okuma; konumuna göre 3–5 öner.",
      durak_ornek: duraklar.map((d) => ({ ad: String(d.ad), mesafe_m: Math.round(Number(d.min_m)) })),
      hatlar: hatlar.map((h) => ({
        kod: String(h.kod),
        slug: String(h.slug),
        ad: String(h.ad),
        tur: h.bus_type_name,
        merkez_durak: Number(h.merkez_durak),
        min_m: Math.round(Number(h.min_m)),
      })),
    },
  };
}

async function yakinDuraklar(args: Record<string, unknown>): Promise<FnResult> {
  const lat = num(args.lat);
  const lng = num(args.lng);
  if (lat == null || lng == null) return konumYok();
  if (lat < 40.2 || lat > 41.2 || lng < 29.8 || lng > 31.2) {
    return { ok: false, error: "konum Sakarya civarında olmalı" };
  }
  const cap = Math.min(1500, Math.max(50, num(args.yari_cap_m) ?? 600));
  const duraklar = await query<RowDataPacket[]>(
    `SELECT d.id, d.ad, d.lat, d.lng,
            ST_Distance_Sphere(POINT(d.lng, d.lat), POINT(?, ?)) AS mesafe_m
     FROM duraklar d
     WHERE ST_Distance_Sphere(POINT(d.lng, d.lat), POINT(?, ?)) <= ?
     ORDER BY mesafe_m
     LIMIT 25`,
    [lng, lat, lng, lat, cap],
  );
  const ids = duraklar.map((d) => Number(d.id));
  let hatlarByDurak = new Map<number, { kod: string; ad: string }[]>();
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    const hatlar = await query<RowDataPacket[]>(
      `SELECT hd.durak_id, h.kod, h.ad
       FROM hat_duraklari hd
       JOIN hatlar h ON h.id = hd.hat_id
       WHERE hd.durak_id IN (${ph})
       GROUP BY hd.durak_id, h.id, h.kod, h.ad`,
      ids,
    );
    hatlarByDurak = new Map();
    for (const h of hatlar) {
      const did = Number(h.durak_id);
      const list = hatlarByDurak.get(did) ?? [];
      list.push({ kod: String(h.kod), ad: String(h.ad) });
      hatlarByDurak.set(did, list);
    }
  }
  return {
    ok: true,
    data: {
      yari_cap_m: cap,
      adet: duraklar.length,
      duraklar: duraklar.map((d) => ({
        id: Number(d.id),
        ad: String(d.ad),
        mesafe_m: Math.round(Number(d.mesafe_m)),
        yurume_dk: yurumeDk(Number(d.mesafe_m)),
        hatlar: hatlarByDurak.get(Number(d.id)) ?? [],
      })),
    },
  };
}

type YakinDurakOzet = { ad: string; mesafe_m: number; hatlar: { kod: string; ad: string }[] };

function yakinDurakListesi(data: unknown): YakinDurakOzet[] {
  if (!data || typeof data !== "object") return [];
  const duraklar = (data as { duraklar?: unknown }).duraklar;
  if (!Array.isArray(duraklar)) return [];
  return duraklar.filter((d): d is YakinDurakOzet => {
    if (!d || typeof d !== "object") return false;
    const o = d as YakinDurakOzet;
    return typeof o.ad === "string" && typeof o.mesafe_m === "number" && Array.isArray(o.hatlar);
  });
}

function binisDuragi(kod: string, duraklar: YakinDurakOzet[]): { ad: string; mesafe_m: number } | null {
  for (const d of duraklar) {
    if (d.hatlar.some((h) => h.kod === kod)) return { ad: d.ad, mesafe_m: d.mesafe_m };
  }
  return null;
}

async function direktHatlar(opts: {
  lat: number;
  lng: number;
  yer: YerKayit;
  cap: number;
}): Promise<RowDataPacket[]> {
  const { lat, lng, yer, cap } = opts;
  const dlat = yer.merkez!.lat;
  const dlng = yer.merkez!.lng;
  const dcap = yer.yari_cap_m!;
  return query<RowDataPacket[]>(
    `SELECT h.id, h.kod, h.slug, h.ad, h.bus_type_name,
            MIN(ST_Distance_Sphere(POINT(d.lng, d.lat), POINT(?, ?))) AS binis_m
     FROM hatlar h
     JOIN hat_duraklari hd ON hd.hat_id = h.id
     JOIN duraklar d ON d.id = hd.durak_id
     WHERE ST_Distance_Sphere(POINT(d.lng, d.lat), POINT(?, ?)) <= ?
       AND EXISTS (
         SELECT 1
         FROM hat_duraklari hd2
         JOIN duraklar d2 ON d2.id = hd2.durak_id
         WHERE hd2.hat_id = h.id
           AND ST_Distance_Sphere(POINT(d2.lng, d2.lat), POINT(?, ?)) <= ?
       )
     GROUP BY h.id, h.kod, h.slug, h.ad, h.bus_type_name
     ORDER BY binis_m
     LIMIT 12`,
    [lng, lat, lng, lat, cap, dlng, dlat, dcap],
  );
}

async function rotaOneri(args: Record<string, unknown>): Promise<FnResult> {
  const hedefRaw = str(args.hedef) || str(args.yer) || str(args.q);
  const yer = eslesenYer(hedefRaw);
  if (!yer?.merkez || !yer.yari_cap_m) {
    return { ok: false, error: "bilinen yer yok. şimdilik: çarşı, adapazarı merkez, orta garaj, o. garaj" };
  }
  const lat = num(args.lat);
  const lng = num(args.lng);
  if (lat == null || lng == null) return konumYok();
  if (lat < 40.2 || lat > 41.2 || lng < 29.8 || lng > 31.2) {
    return { ok: false, error: "konum Sakarya civarında olmalı" };
  }

  const hedefM = Math.round(haversineM({ lat, lng }, yer.merkez));
  if (hedefM <= yer.yari_cap_m) {
    const yakin = await yakinDuraklar({ lat, lng, yari_cap_m: 600 });
    return {
      ok: true,
      data: {
        zaten_hedefte: true,
        hedef: { soz: yer.soz, anlam: yer.anlam },
        not: "Kullanıcı zaten bu yerin yakınında. Direkt hat önerme; yakın durakları söyle. Metre/koordinat okuma.",
        yakin: yakin.ok ? yakin.data : null,
      },
    };
  }

  const istenen = Math.min(1500, Math.max(50, num(args.yari_cap_m) ?? 600));
  const tryCaps = [...new Set([istenen, 600, 900, 1200])].sort((a, b) => a - b);
  let kullanilan = tryCaps[0] ?? 600;
  let rows: RowDataPacket[] = [];
  for (const cap of tryCaps) {
    kullanilan = cap;
    rows = await direktHatlar({ lat, lng, yer, cap });
    if (rows.length) break;
  }

  const yakin = await yakinDuraklar({ lat, lng, yari_cap_m: kullanilan });
  const duraklar = yakinDurakListesi(yakin.data).slice(0, 8);
  const hatIds = rows.map((h) => Number(h.id)).filter((id) => Number.isFinite(id));
  const canliByHat = new Map<number, ReturnType<typeof mapArac>[]>();
  if (hatIds.length) {
    const ph = hatIds.map(() => "?").join(",");
    const araclar = await query<RowDataPacket[]>(
      `SELECT hat_id, bus_number, plate, lat, lng, speed, heading, status, route_name, next_stop_name, at_stop_name, updated_at
       FROM arac_son_konum WHERE hat_id IN (${ph}) ORDER BY updated_at DESC`,
      hatIds,
    );
    for (const v of araclar) {
      const hid = Number(v.hat_id);
      const list = canliByHat.get(hid) ?? [];
      list.push(mapArac(v));
      canliByHat.set(hid, list);
    }
  }

  return {
    ok: true,
    data: {
      zaten_hedefte: false,
      hedef: { soz: yer.soz, anlam: yer.anlam },
      direkt_adet: rows.length,
      direkt: rows.map((h) => {
        const kod = String(h.kod);
        const hid = Number(h.id);
        const arac = canliByHat.get(hid) ?? [];
        const binis = binisDuragi(kod, duraklar);
        return {
          kod,
          ad: String(h.ad),
          binis: binis
            ? { ad: binis.ad, yurume_dk: yurumeDk(binis.mesafe_m) }
            : null,
          arac,
        };
      }),
      yakin_duraklar: duraklar.map((d) => ({
        ad: d.ad,
        yurume_dk: yurumeDk(d.mesafe_m),
        hatlar: d.hatlar.map((h) => h.kod),
      })),
      not: rows.length
        ? "Yolcuya günlük dille 3–4 hat söyle: hangi hatta, hangi duraktan, yaklaşık kaç dk yürüme. cumle varsa onu kullan. Plaka, koordinat, araç no okuma. Canlı araç yoksa 1–2 hat için otobus_anlik_konum_sorgula çağır; tool adını yolcuya söyleme."
        : "Yakın duraktan hedefe direkt hat yok. Aktarma uydurma. Yakın durakları söyle.",
    },
  };
}

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<FnResult>> = {
  otobus_sorgula: otobusSorgula,
  otobus_guzergah_sorgula: otobusGuzergahSorgula,
  otobus_anlik_konum_sorgula: otobusAnlikKonum,
  otobus_saat_sorgula: otobusSaatSorgula,
  yakin_duraklar: yakinDuraklar,
  yerden_gecen_hatlar: yerdenGecenHatlar,
  rota_oneri: rotaOneri,
};

export function fonksiyonVar(kod: string): boolean {
  return Boolean(HANDLERS[kod]);
}

export function fonksiyonByKod(kod: string): FonksiyonTanim | undefined {
  return FONKSIYONLAR.find((f) => f.kod === kod);
}

export function fonksiyonJsonSchema(fn: FonksiyonTanim): {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
} {
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];
  for (const a of fn.args) {
    properties[a.name] = { type: a.type, description: a.aciklama };
    if (a.required) required.push(a.name);
  }
  return { type: "object", properties, required };
}

export async function calistirFonksiyon(
  kod: string,
  args: Record<string, unknown>,
  meta?: { toolAd?: string; oturumId?: string | null },
): Promise<FnResult> {
  const fn = HANDLERS[kod];
  if (!fn) return { ok: false, error: `fonksiyon yok: ${kod}` };
  const t0 = Date.now();
  let filled = args ?? {};
  if (KONUM_KODLARI.has(kod) && meta?.oturumId) {
    const o = await oturumKonumu(meta.oturumId);
    if (o) filled = { ...filled, lat: o.lat, lng: o.lng };
  }
  let result: FnResult;
  try {
    result = await fn(filled);
  } catch (e) {
    result = { ok: false, error: String((e as Error).message) };
  }
  const ozet = { ...filled };
  if ("lat" in ozet && typeof ozet.lat === "number") ozet.lat = Math.round(ozet.lat * 1000) / 1000;
  if ("lng" in ozet && typeof ozet.lng === "number") ozet.lng = Math.round(ozet.lng * 1000) / 1000;
  try {
    await exec(
      `INSERT INTO kullanici_olaylari (oturum_id, tool_ad, fonksiyon_kod, input_json, ok, sure_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [meta?.oturumId ?? null, meta?.toolAd ?? null, kod, JSON.stringify(ozet), result.ok ? 1 : 0, Date.now() - t0],
    );
  } catch {
    /* tablo yoksa yutma — migrate henüz olmamış olabilir */
  }
  return result;
}
