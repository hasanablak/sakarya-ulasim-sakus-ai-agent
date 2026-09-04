export type ChatMessage = {
  id: number;
  rol: "user" | "assistant" | "system" | "tool";
  icerik: string;
  created_at: string;
};

const adminTokenKey = "sakus_admin_token";
const sessionKey = "sakus_chat_session";

export function getAdminToken(): string | null {
  return localStorage.getItem(adminTokenKey);
}

export function setAdminToken(token: string | null): void {
  if (token) localStorage.setItem(adminTokenKey, token);
  else localStorage.removeItem(adminTokenKey);
}

export function getSessionId(slug = "public", host?: string): string | null {
  const key = host ? `${sessionKey}:${slug}:${host}` : `${sessionKey}:${slug}`;
  return localStorage.getItem(key) ?? (slug === "public" && !host ? localStorage.getItem(sessionKey) : null);
}

export function setSessionId(id: string, slug = "public", host?: string): void {
  const key = host ? `${sessionKey}:${slug}:${host}` : `${sessionKey}:${slug}`;
  localStorage.setItem(key, id);
}

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function adminHeaders(): HeadersInit {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}`, "content-type": "application/json" } : { "content-type": "application/json" };
}

export const api = {
  health: () => fetch("/api/health").then(parse),
  hatlar: (q?: string) => fetch(`/api/hatlar${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(parse),
  chatGet: (id: string) => fetch(`/api/chat/${id}`).then(parse),
  chatSend: (body: {
    sessionId?: string;
    message: string;
    origin?: { lat: number; lng: number };
    konum_durum?: string;
    webchatSlug?: string;
    webchatKey?: string;
    host?: string;
    kaynak?: string;
  }) =>
    fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then(parse),
  adminLogin: (password: string) =>
    fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).then(parse),
  adminHatlar: (q?: string) =>
    fetch(`/api/admin/hatlar${q ? `?q=${encodeURIComponent(q)}` : ""}`, { headers: adminHeaders() }).then(parse),
  adminHat: (slug: string) => fetch(`/api/admin/hatlar/${slug}`, { headers: adminHeaders() }).then(parse),
  ingest: (body: { slug?: string; limit?: number }) =>
    fetch("/api/admin/ingest", { method: "POST", headers: adminHeaders(), body: JSON.stringify(body) }).then(parse),
  job: (id: number) => fetch(`/api/admin/jobs/${id}`, { headers: adminHeaders() }).then(parse),
  liveStart: (slug: string) =>
    fetch("/api/admin/live/start", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ slug }) }).then(parse),
  liveStop: (slug: string) =>
    fetch("/api/admin/live/stop", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ slug }) }).then(parse),
  sohbetler: (webchatId?: number) =>
    fetch(`/api/admin/sohbetler${webchatId ? `?webchat_id=${webchatId}` : ""}`, { headers: adminHeaders() }).then(parse),
  sohbet: (id: string) => fetch(`/api/admin/sohbetler/${id}`, { headers: adminHeaders() }).then(parse),
  fonksiyonlar: () => fetch("/api/admin/fonksiyonlar", { headers: adminHeaders() }).then(parse),
  fonksiyonCalistir: (kod: string, body: { args?: Record<string, unknown>; toolAd?: string }) =>
    fetch(`/api/admin/fonksiyonlar/${encodeURIComponent(kod)}/calistir`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }).then(parse),
  toollar: () => fetch("/api/admin/toollar", { headers: adminHeaders() }).then(parse),
  tool: (id: number) => fetch(`/api/admin/toollar/${id}`, { headers: adminHeaders() }).then(parse),
  toolKaydet: (body: { ad: string; aciklama: string; fonksiyon_kod: string; aktif: boolean }, id?: number) =>
    fetch(id ? `/api/admin/toollar/${id}` : "/api/admin/toollar", {
      method: id ? "PUT" : "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }).then(parse),
  toolSil: (id: number) =>
    fetch(`/api/admin/toollar/${id}`, { method: "DELETE", headers: adminHeaders() }).then(parse),
  agentler: () => fetch("/api/admin/agentler", { headers: adminHeaders() }).then(parse),
  agent: (id: number) => fetch(`/api/admin/agentler/${id}`, { headers: adminHeaders() }).then(parse),
  agentKaydet: (
    body: {
      ad: string;
      aciklama: string;
      sistem_prompt: string;
      llm_saglayici: string;
      model: string;
      api_token?: string;
      aktif: boolean;
      tool_ids: number[];
    },
    id?: number,
  ) =>
    fetch(id ? `/api/admin/agentler/${id}` : "/api/admin/agentler", {
      method: id ? "PUT" : "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }).then(parse),
  agentSil: (id: number) =>
    fetch(`/api/admin/agentler/${id}`, { method: "DELETE", headers: adminHeaders() }).then(parse),
  webchat: (ref?: string) => {
    if (!ref) return fetch("/api/webchat").then(parse);
    const q = /^[0-9a-f-]{36}$/i.test(ref) ? `key=${encodeURIComponent(ref)}` : `slug=${encodeURIComponent(ref)}`;
    return fetch(`/api/webchat?${q}`).then(parse);
  },
  webchatler: () => fetch("/api/admin/webchatler", { headers: adminHeaders() }).then(parse),
  webchatGet: (id: number) => fetch(`/api/admin/webchatler/${id}`, { headers: adminHeaders() }).then(parse),
  webchatKaydet: (
    body: {
      ad: string;
      slug: string;
      agent_id: number | null;
      baslik: string;
      karsilama: string;
      placeholder: string;
      fab_ac: string;
      fab_kapat: string;
      konum: string;
      tema: Record<string, unknown>;
      aktif: boolean;
      varsayilan: boolean;
    },
    id?: number,
  ) =>
    fetch(id ? `/api/admin/webchatler/${id}` : "/api/admin/webchatler", {
      method: id ? "PUT" : "POST",
      headers: adminHeaders(),
      body: JSON.stringify(body),
    }).then(parse),
  webchatSil: (id: number) =>
    fetch(`/api/admin/webchatler/${id}`, { method: "DELETE", headers: adminHeaders() }).then(parse),
};
