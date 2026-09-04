export const SAKUS_BASE_URL = "https://sakus.sakarya.bel.tr";
export const SAKUS_API_BASE_URL = "https://sbbpublicapi.sakarya.bel.tr";
export const ULASIM_PORTAL_URL = "https://ulasim.sakarya.bel.tr";

export function sakusHatHaritaUrl(slug: string): string {
  return `${SAKUS_BASE_URL}/harita?hat=${encodeURIComponent(slug)}`;
}

export function ulasimHatSaatUrl(slug: string): string {
  return `${ULASIM_PORTAL_URL}/ulasim/hat/${encodeURIComponent(slug)}`;
}

export type GunKod = "haftaici" | "cumartesi" | "pazar";

export const GUN_KODLARI: GunKod[] = ["haftaici", "cumartesi", "pazar"];

export function scheduleQueryDates(now = new Date()): { gunKod: GunKod; date: string }[] {
  const found = new Map<GunKod, string>();
  for (let i = 0; i < 8 && found.size < 3; i++) {
    const t = new Date(now.getTime() + i * 86400000);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(t);
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(t);
    const gunKod: GunKod = wd === "Sat" ? "cumartesi" : wd === "Sun" ? "pazar" : "haftaici";
    if (!found.has(gunKod)) found.set(gunKod, date);
  }
  return GUN_KODLARI.filter((g) => found.has(g)).map((gunKod) => ({ gunKod, date: found.get(gunKod)! }));
}

/** Belediye + özel halk otobüsü hat listeleri */
export const LINE_LIST_BUS_TYPES = [3869, 5731] as const;

export const LLM_SAGLAYICILAR = [
  { id: "openai", ad: "OpenAI" },
  { id: "anthropic", ad: "Claude (Anthropic)" },
  { id: "google", ad: "Google Gemini" },
  { id: "groq", ad: "Groq" },
  { id: "wiro", ad: "Wiro (Gemini 3.7 Flash)" },
] as const;

export type LlmSaglayici = (typeof LLM_SAGLAYICILAR)[number]["id"];

export const FONKSIYON_KODLARI = [
  "otobus_sorgula",
  "otobus_guzergah_sorgula",
  "otobus_anlik_konum_sorgula",
  "otobus_saat_sorgula",
  "yakin_duraklar",
] as const;

export type FonksiyonKod = (typeof FONKSIYON_KODLARI)[number];

export type ToolFnResult = { ok: boolean; data?: unknown; error?: string; stale?: boolean };

export const DEFAULT_WEBCHAT_TEMA = {
  header_bg: "#16332b",
  header_fg: "#d8f06a",
  fab_bg: "#16332b",
  fab_fg: "#d8f06a",
  panel_bg: "#fffaf2",
  user_bg: "#1f4a3d",
  user_fg: "#ffffff",
  bot_bg: "#efe6d6",
  bot_fg: "#1c1915",
  border: "#d7cbb8",
  panel_width: 380,
} as const;

export type WebchatTema = {
  header_bg: string;
  header_fg: string;
  fab_bg: string;
  fab_fg: string;
  panel_bg: string;
  user_bg: string;
  user_fg: string;
  bot_bg: string;
  bot_fg: string;
  border: string;
  panel_width: number;
};

export type WebchatKonum = "sag_alt" | "sol_alt";

export type WebchatPublic = {
  id: number;
  embed_key: string;
  slug: string;
  ad: string;
  agent_id: number | null;
  agent_ad: string | null;
  baslik: string;
  karsilama: string;
  placeholder: string;
  fab_ac: string;
  fab_kapat: string;
  konum: WebchatKonum;
  tema: WebchatTema;
  aktif: boolean;
  varsayilan: boolean;
};

export const EMBED_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isEmbedKey(v: string): boolean {
  return EMBED_KEY_RE.test(v.trim());
}

export function mergeWebchatTema(raw: unknown): WebchatTema {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hex = (v: unknown, fb: string) =>
    typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fb;
  const width = Number(src.panel_width);
  return {
    header_bg: hex(src.header_bg, DEFAULT_WEBCHAT_TEMA.header_bg),
    header_fg: hex(src.header_fg, DEFAULT_WEBCHAT_TEMA.header_fg),
    fab_bg: hex(src.fab_bg, DEFAULT_WEBCHAT_TEMA.fab_bg),
    fab_fg: hex(src.fab_fg, DEFAULT_WEBCHAT_TEMA.fab_fg),
    panel_bg: hex(src.panel_bg, DEFAULT_WEBCHAT_TEMA.panel_bg),
    user_bg: hex(src.user_bg, DEFAULT_WEBCHAT_TEMA.user_bg),
    user_fg: hex(src.user_fg, DEFAULT_WEBCHAT_TEMA.user_fg),
    bot_bg: hex(src.bot_bg, DEFAULT_WEBCHAT_TEMA.bot_bg),
    bot_fg: hex(src.bot_fg, DEFAULT_WEBCHAT_TEMA.bot_fg),
    border: hex(src.border, DEFAULT_WEBCHAT_TEMA.border),
    panel_width: Number.isFinite(width) ? Math.min(480, Math.max(280, Math.round(width))) : DEFAULT_WEBCHAT_TEMA.panel_width,
  };
}

export const INTERNAL_NS = "/internal";

export const EVENTS = {
  aracKonum: "arac.konum",
  ingestProgress: "hat.ingest.progress",
  ingestDone: "hat.ingest.done",
  scraperHealth: "scraper.health",
  subscribeHat: "subscribe.hat",
} as const;

export type SakusLineListItem = {
  id: number;
  name: string | null;
  lineNumber: string | null;
  busTypeName: string | null;
  busTypeDescription: string | null;
  busTypeColor: string | null;
  busTypeId: number | null;
  asisIntegrationId: number | null;
  slug: string;
};

export type SakusPoint = {
  type: "Point";
  coordinates: [number, number];
};

export type SakusBusStop = {
  id: number;
  order: number;
  name: string;
  busStopGeometry: SakusPoint;
  description: string | null;
  busStopTypeName: string | null;
  busStopTypeId: number | null;
  isSmartStop: boolean;
  busStopNumber: number | null;
};

export type SakusRoute = {
  routeId: number;
  routeName: string;
  routeGeometry: {
    type: "MultiLineString" | "LineString";
    coordinates: unknown;
  };
  busStops: SakusBusStop[];
  routeTypeId: number | null;
  startLocation: string | null;
  endLocation: string | null;
};

export type SakusRouteAndStops = {
  lineId: number;
  lineName: string;
  lineDetail: string | null;
  typeValueId: number | null;
  lineNumber: string;
  routes: SakusRoute[];
  ekentLineIntegrationId: number | null;
};

export type SakusScheduleTrip = {
  dayParameterValueId: number | null;
  startTime: string;
  endTime: string | null;
  tripNumber: number | null;
  description: string | null;
};

export type SakusRouteSchedule = {
  routeId: number;
  routeName: string;
  routeDetail: SakusScheduleTrip[];
};

export type SakusLineSchedule = {
  lineId: number;
  lineName: string | null;
  lineNumber: string | null;
  schedules: SakusRouteSchedule[];
};

export type ScheduleDayPayload = {
  gunKod: GunKod;
  date: string;
  data: SakusLineSchedule | null;
};

export type SakusVehicle = {
  busNumber: number;
  lineNumber: string;
  location: SakusPoint;
  trackingId: number;
  lineId: number;
  speed: number | null;
  lineName: string | null;
  nextStopId: number | null;
  nextStopName: string | null;
  atStopId: number | null;
  atStopName: string | null;
  status: string | null;
  routeName: string | null;
  routeId: number | null;
  distNextStopMeter: number | null;
  headingDegree: number | null;
  etaS: number | null;
  nhatNo: number | null;
  plate: string | null;
  startLocation: string | null;
  endLocation: string | null;
};

export type NormalizedVehicle = {
  busNumber: number;
  hatId: number;
  lineNumber: string;
  plate: string | null;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  status: string | null;
  routeId: number | null;
  routeName: string | null;
  nextStopId: number | null;
  nextStopName: string | null;
  atStopId: number | null;
  atStopName: string | null;
  etaS: number | null;
  distNextStopM: number | null;
  trackingId: number | null;
  startLocation: string | null;
  endLocation: string | null;
  updatedAt: string;
};

export type AracKonumPayload = {
  hatSlug: string;
  hatId: number | null;
  vehicles: NormalizedVehicle[];
  source: "intercept" | "sse" | "poll";
};

export type IngestProgressPayload = {
  jobId: number | null;
  current: number;
  total: number;
  slug: string | null;
  message: string;
};

export function normalizeVehicle(v: SakusVehicle): NormalizedVehicle | null {
  const coords = v.location?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  return {
    busNumber: v.busNumber,
    hatId: v.lineId,
    lineNumber: v.lineNumber,
    plate: v.plate,
    lat,
    lng,
    speed: v.speed,
    heading: v.headingDegree,
    status: v.status,
    routeId: v.routeId,
    routeName: v.routeName,
    nextStopId: v.nextStopId,
    nextStopName: v.nextStopName,
    atStopId: v.atStopId,
    atStopName: v.atStopName,
    etaS: v.etaS,
    distNextStopM: v.distNextStopMeter,
    trackingId: v.trackingId,
    startLocation: v.startLocation,
    endLocation: v.endLocation,
    updatedAt: new Date().toISOString(),
  };
}

export function lineIdFromSlug(slug: string): number | null {
  const last = slug.trim().split("-").pop();
  if (!last || !/^\d+$/.test(last)) return null;
  return Number(last);
}

export function isLineListUrl(url: string): boolean {
  return url.includes("/api/v1/Ulasim?busType=");
}

export function isRouteStopsUrl(url: string): boolean {
  return url.includes("/api/v1/Ulasim/route-and-busstops/");
}

export function isLineScheduleUrl(url: string): boolean {
  return url.includes("/api/v1/Ulasim/line-schedule");
}

export function isVehicleTrackingUrl(url: string): boolean {
  return (
    url.includes("/api/v1/VehicleTracking") ||
    url.includes("/api/v1/sakus/vehicle-tracking/stream")
  );
}

export function parseSseVehicles(chunk: string): SakusVehicle[] {
  const out: SakusVehicle[] = [];
  for (const block of chunk.split("\n\n")) {
    const dataLine = block
      .split("\n")
      .find((l) => l.startsWith("data:"));
    if (!dataLine) continue;
    const raw = dataLine.slice(5).trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as SakusVehicle | SakusVehicle[];
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* ignore partial frames */
    }
  }
  return out;
}
