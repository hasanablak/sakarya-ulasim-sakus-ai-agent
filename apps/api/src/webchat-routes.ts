import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { widgetLoaderScript } from "./embed-script.js";
import {
  createWebchat,
  deleteWebchat,
  getPublicWebchat,
  getWebchat,
  listWebchatler,
  updateWebchat,
} from "./webchat-store.js";

function bad(reply: FastifyReply, e: unknown, code = 400) {
  const error = e instanceof Error ? e.message : String(e);
  return reply.code(code).send({ ok: false, error });
}

export function registerWebchatRoutes(
  app: FastifyInstance,
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<boolean>,
): void {
  app.get("/api/webchat", async (req) => {
    const q = req.query as { slug?: string; key?: string };
    const ref = (q.key || q.slug || "").trim() || undefined;
    const webchat = await getPublicWebchat(ref);
    if (!webchat) return { ok: true, webchat: null };
    return { ok: true, webchat };
  });

  app.get("/api/embed/:file", async (req, reply) => {
    const file = (req.params as { file: string }).file;
    if (!file.endsWith(".js")) return reply.code(404).send({ ok: false, error: "script yok" });
    const ref = file.slice(0, -3);
    const webchat = await getPublicWebchat(ref);
    if (!webchat) {
      return reply
        .code(404)
        .type("application/javascript; charset=utf-8")
        .send(`console.warn(${JSON.stringify(`SAKUS webchat bulunamadı: ${ref}`)});`);
    }
    return reply
      .header("Cache-Control", "public, max-age=60")
      .header("Access-Control-Allow-Origin", "*")
      .type("application/javascript; charset=utf-8")
      .send(widgetLoaderScript(webchat.embed_key));
  });

  app.get("/api/admin/webchatler", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    return { ok: true, webchatler: await listWebchatler() };
  });

  app.post("/api/admin/webchatler", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    try {
      const webchat = await createWebchat(req.body as object);
      return reply.code(201).send({ ok: true, webchat });
    } catch (e) {
      return bad(reply, e);
    }
  });

  app.get("/api/admin/webchatler/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    const webchat = await getWebchat(id);
    if (!webchat) return reply.code(404).send({ ok: false, error: "webchat yok" });
    return { ok: true, webchat };
  });

  app.put("/api/admin/webchatler/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    try {
      const webchat = await updateWebchat(id, req.body as object);
      if (!webchat) return reply.code(404).send({ ok: false, error: "webchat yok" });
      return { ok: true, webchat };
    } catch (e) {
      return bad(reply, e);
    }
  });

  app.delete("/api/admin/webchatler/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    const ok = await deleteWebchat(id);
    if (!ok) return reply.code(404).send({ ok: false, error: "webchat yok" });
    return { ok: true };
  });
}
