import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { scraperConfig } from "./config.js";
import { runIngest } from "./ingest.js";
import { runLive } from "./live.js";

let ingestRunning = false;
const liveAbort = new Map<string, AbortController>();

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage): boolean {
  return req.headers["x-internal-secret"] === scraperConfig.internalSecret;
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

async function notifyApi(path: string, body: unknown): Promise<void> {
  await fetch(`${scraperConfig.apiPublic}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": scraperConfig.internalSecret,
    },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.error(JSON.stringify({ type: "notify.error", path, message: String(err) }));
  });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://scraper.local");
  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true, ingestRunning, live: [...liveAbort.keys()] });
    return;
  }
  if (!authorized(req)) {
    json(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/ingest") {
    if (ingestRunning) {
      json(res, 409, { ok: false, error: "ingest zaten çalışıyor" });
      return;
    }
    const body = await readBody(req);
    const jobId = typeof body.jobId === "number" ? body.jobId : null;
    const slug = typeof body.slug === "string" ? body.slug : undefined;
    const limit = typeof body.limit === "number" ? body.limit : undefined;
    ingestRunning = true;
    json(res, 202, { ok: true, jobId });
    void runIngest({
      jobId,
      slug,
      limit,
      onLog: (row) => {
        if (jobId != null) {
          void notifyApi("/api/internal/ingest/progress", { jobId, line: JSON.stringify(row).slice(0, 3500) });
        }
      },
    })
      .then(() => notifyApi("/api/internal/ingest/done", { jobId, ok: true }))
      .catch((err) =>
        notifyApi("/api/internal/ingest/done", {
          jobId,
          ok: false,
          error: String(err?.message ?? err),
        }),
      )
      .finally(() => {
        ingestRunning = false;
      });
    return;
  }

  if (req.method === "POST" && url.pathname === "/live/start") {
    const body = await readBody(req);
    const slug = typeof body.slug === "string" ? body.slug : "";
    if (!slug) {
      json(res, 400, { ok: false, error: "slug gerekli" });
      return;
    }
    if (!liveAbort.has(slug)) {
      const ac = new AbortController();
      liveAbort.set(slug, ac);
      void runLive(slug, ac.signal).finally(() => {
        liveAbort.delete(slug);
      });
    }
    json(res, 202, { ok: true, live: [...liveAbort.keys()] });
    return;
  }

  if (req.method === "POST" && url.pathname === "/live/stop") {
    const body = await readBody(req);
    const slug = typeof body.slug === "string" ? body.slug : "";
    liveAbort.get(slug)?.abort();
    liveAbort.delete(slug);
    json(res, 200, { ok: true, live: [...liveAbort.keys()] });
    return;
  }

  json(res, 404, { ok: false, error: "not found" });
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    json(res, 500, { ok: false, error: String(err?.message ?? err) });
  });
});

server.listen(scraperConfig.workerPort, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      type: "worker.listen",
      port: scraperConfig.workerPort,
      apiPublic: scraperConfig.apiPublic,
      chrome: scraperConfig.chromePath ?? "bundled",
    }),
  );
});
