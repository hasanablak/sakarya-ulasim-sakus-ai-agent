import type { RowDataPacket } from "mysql2";
import { exec, query } from "./db.js";
import { getHatBySlug, listHatlar } from "./jobs.js";

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
    aciklama: "Kayıtlı hatların özetini toplu döner (kod, ad, durak/sefer/araç sayısı).",
    args: [{ name: "q", type: "string", required: false, aciklama: "Kod, ad veya slug filtresi" }],
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
    aciklama: "Bir hattın son bilinen araç konumları. Canlı takip kapalıysa stale olur.",
    args: [{ name: "hat", type: "string", required: true, aciklama: "Hat kodu veya slug" }],
  },
  {
    kod: "otobus_saat_sorgula",
    ad: "Otobüs saat sorgula",
    aciklama: "Hattın hareket saatleri (kalkış/varış). gun_kod: haftaici, cumartesi, pazar.",
    args: [
      { name: "hat", type: "string", required: true, aciklama: "Hat kodu veya slug" },
      { name: "gun_kod", type: "string", required: false, aciklama: "haftaici | cumartesi | pazar" },
    ],
  },
  {
    kod: "yakin_duraklar",
    ad: "Yakın duraklar",
    aciklama: "Konuma en yakın duraklar ve geçen hatlar. Varsayılan yürüme 600 m.",
    args: [
      { name: "lat", type: "number", required: true, aciklama: "Enlem" },
      { name: "lng", type: "number", required: true, aciklama: "Boylam" },
      { name: "yari_cap_m", type: "number", required: false, aciklama: "Metre, varsayılan 600" },
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

function todayGunKod(): "haftaici" | "cumartesi" | "pazar" {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(new Date());
  if (wd === "Sat") return "cumartesi";
  if (wd === "Sun") return "pazar";
  return "haftaici";
}

function staleOf(updatedAt: Date | string | null): boolean {
  if (!updatedAt) return true;
  const t = new Date(updatedAt).getTime();
  return Number.isNaN(t) || Date.now() - t > STALE_MS;
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
  const ozet = await query<RowDataPacket[]>(
    `SELECT h.id, h.kod, h.slug, h.ad, h.bus_type_name, h.last_ingested_at,
            (SELECT COUNT(DISTINCT hd.durak_id) FROM hat_duraklari hd WHERE hd.hat_id = h.id) AS durak_sayisi,
            (SELECT COUNT(*) FROM hat_seferleri s WHERE s.hat_id = h.id) AS sefer_sayisi,
            (SELECT COUNT(*) FROM arac_son_konum a WHERE a.hat_id = h.id) AS arac_sayisi
     FROM hatlar h
     ${q ? "WHERE h.kod LIKE ? OR h.ad LIKE ? OR h.slug LIKE ?" : ""}
     ORDER BY h.kod`,
    q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [],
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
    const byRoute = new Map<number, { yon: string; duraklar: { sira: number; ad: string; lat: number; lng: number }[] }>();
    for (const s of stops) {
      const id = Number(s.sakus_route_id);
      if (!byRoute.has(id)) byRoute.set(id, { yon: String(s.yon_ad), duraklar: [] });
      byRoute.get(id)!.duraklar.push({
        sira: Number(s.sira),
        ad: String(s.ad),
        lat: Number(s.lat),
        lng: Number(s.lng),
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

async function otobusAnlikKonum(args: Record<string, unknown>): Promise<FnResult> {
  const hatRef = str(args.hat);
  if (!hatRef) return { ok: false, error: "hat gerekli" };
  const hat = await resolveHat(hatRef);
  if (!hat) return { ok: false, error: `hat bulunamadı: ${hatRef}` };
  const vehicles = await query<RowDataPacket[]>(
    `SELECT bus_number, plate, lat, lng, speed, heading, status, route_name, next_stop_name, at_stop_name, updated_at
     FROM arac_son_konum WHERE hat_id = ? ORDER BY updated_at DESC`,
    [hat.id],
  );
  const latest = vehicles[0]?.updated_at as Date | undefined;
  const stale = staleOf(latest ?? null);
  return {
    ok: true,
    stale,
    data: {
      hat: { kod: hat.kod, ad: hat.ad, slug: hat.slug },
      arac: vehicles.map((v) => ({
        no: v.bus_number,
        plaka: v.plate,
        lat: Number(v.lat),
        lng: Number(v.lng),
        hiz: v.speed != null ? Number(v.speed) : null,
        yon: v.heading != null ? Number(v.heading) : null,
        durum: v.status,
        guzergah: v.route_name,
        sonraki_durak: v.next_stop_name,
        durakta: v.at_stop_name,
        guncelleme: v.updated_at,
      })),
      uyari: vehicles.length === 0 ? "Anlık kayıt yok. Admin’den bu hat için canlı takibi aç." : stale ? "Konum 30 sn’den eski (stale)." : null,
    },
  };
}

async function otobusSaatSorgula(args: Record<string, unknown>): Promise<FnResult> {
  const hatRef = str(args.hat);
  if (!hatRef) return { ok: false, error: "hat gerekli" };
  const hat = await resolveHat(hatRef);
  if (!hat) return { ok: false, error: `hat bulunamadı: ${hatRef}` };
  const gun = str(args.gun_kod) || todayGunKod();
  const rows = await query<RowDataPacket[]>(
    `SELECT sakus_route_id, yon_ad, gun_kod, sefer_no, kalkis, varis
     FROM hat_seferleri WHERE hat_id = ? AND gun_kod = ?
     ORDER BY sakus_route_id, kalkis`,
    [hat.id, gun],
  );
  const byYon = new Map<string, { kalkis: string; varis: string | null; sefer: number | null }[]>();
  for (const r of rows) {
    const yon = String(r.yon_ad);
    if (!byYon.has(yon)) byYon.set(yon, []);
    byYon.get(yon)!.push({
      kalkis: String(r.kalkis).slice(0, 8),
      varis: r.varis != null ? String(r.varis).slice(0, 8) : null,
      sefer: r.sefer_no != null ? Number(r.sefer_no) : null,
    });
  }
  return {
    ok: true,
    data: {
      hat: { kod: hat.kod, ad: hat.ad, slug: hat.slug },
      gun_kod: gun,
      yonler: [...byYon.entries()].map(([yon, seferler]) => ({ yon, seferler })),
      uyari: rows.length === 0 ? "Bu gün için sefer yok veya saatler henüz çekilmedi." : null,
    },
  };
}

async function yakinDuraklar(args: Record<string, unknown>): Promise<FnResult> {
  const lat = num(args.lat);
  const lng = num(args.lng);
  if (lat == null || lng == null) return { ok: false, error: "lat ve lng gerekli" };
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
        ad: d.ad,
        lat: Number(d.lat),
        lng: Number(d.lng),
        mesafe_m: Math.round(Number(d.mesafe_m)),
        hatlar: hatlarByDurak.get(Number(d.id)) ?? [],
      })),
    },
  };
}

const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<FnResult>> = {
  otobus_sorgula: otobusSorgula,
  otobus_guzergah_sorgula: otobusGuzergahSorgula,
  otobus_anlik_konum_sorgula: otobusAnlikKonum,
  otobus_saat_sorgula: otobusSaatSorgula,
  yakin_duraklar: yakinDuraklar,
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
  let result: FnResult;
  try {
    result = await fn(args ?? {});
  } catch (e) {
    result = { ok: false, error: String((e as Error).message) };
  }
  const ozet = { ...args };
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
