import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  createAgent,
  createTool,
  deleteAgent,
  deleteTool,
  getAgent,
  getTool,
  listAgentler,
  listToollar,
  updateAgent,
  updateTool,
} from "./agent-store.js";
import { FONKSIYONLAR, calistirFonksiyon, fonksiyonVar } from "./tool-functions.js";

function bad(reply: FastifyReply, e: unknown, code = 400) {
  const error = e instanceof Error ? e.message : String(e);
  return reply.code(code).send({ ok: false, error });
}

export function registerAgentAdminRoutes(
  app: FastifyInstance,
  requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<boolean>,
): void {
  app.get("/api/admin/fonksiyonlar", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    return { ok: true, fonksiyonlar: FONKSIYONLAR };
  });

  app.post("/api/admin/fonksiyonlar/:kod/calistir", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const { kod } = req.params as { kod: string };
    if (!fonksiyonVar(kod)) return reply.code(404).send({ ok: false, error: "fonksiyon yok" });
    const body = (req.body as { args?: Record<string, unknown>; sessionId?: string; toolAd?: string }) ?? {};
    const result = await calistirFonksiyon(kod, body.args ?? {}, {
      oturumId: body.sessionId ?? null,
      toolAd: body.toolAd,
    });
    return { ok: true, result };
  });

  app.get("/api/admin/toollar", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    return { ok: true, toollar: await listToollar() };
  });

  app.post("/api/admin/toollar", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    try {
      const tool = await createTool(req.body as object);
      return reply.code(201).send({ ok: true, tool });
    } catch (e) {
      return bad(reply, e);
    }
  });

  app.get("/api/admin/toollar/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    const tool = await getTool(id);
    if (!tool) return reply.code(404).send({ ok: false, error: "tool yok" });
    return { ok: true, tool };
  });

  app.put("/api/admin/toollar/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    try {
      const tool = await updateTool(id, req.body as object);
      if (!tool) return reply.code(404).send({ ok: false, error: "tool yok" });
      return { ok: true, tool };
    } catch (e) {
      return bad(reply, e);
    }
  });

  app.delete("/api/admin/toollar/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    const ok = await deleteTool(id);
    if (!ok) return reply.code(404).send({ ok: false, error: "tool yok" });
    return { ok: true };
  });

  app.get("/api/admin/agentler", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    return { ok: true, agentler: await listAgentler() };
  });

  app.post("/api/admin/agentler", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    try {
      const agent = await createAgent(req.body as object);
      return reply.code(201).send({ ok: true, agent });
    } catch (e) {
      return bad(reply, e);
    }
  });

  app.get("/api/admin/agentler/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    const agent = await getAgent(id);
    if (!agent) return reply.code(404).send({ ok: false, error: "agent yok" });
    return { ok: true, agent };
  });

  app.put("/api/admin/agentler/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    try {
      const agent = await updateAgent(id, req.body as object);
      if (!agent) return reply.code(404).send({ ok: false, error: "agent yok" });
      return { ok: true, agent };
    } catch (e) {
      return bad(reply, e);
    }
  });

  app.delete("/api/admin/agentler/:id", async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    const ok = await deleteAgent(id);
    if (!ok) return reply.code(404).send({ ok: false, error: "agent yok" });
    return { ok: true };
  });
}
