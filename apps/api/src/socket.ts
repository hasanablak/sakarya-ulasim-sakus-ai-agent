import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { EVENTS, INTERNAL_NS, type AracKonumPayload } from "@sakus/shared";
import { apiConfig } from "./config.js";
import { upsertVehicles } from "./jobs.js";

export let publicIo: Server | null = null;

export function attachSockets(httpServer: HttpServer): void {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });
  publicIo = io;

  io.on("connection", (socket) => {
    socket.on(EVENTS.subscribeHat, (slug: string) => {
      if (typeof slug === "string" && slug.length < 200) {
        socket.join(`hat:${slug}`);
      }
    });
  });

  const internal = io.of(INTERNAL_NS);
  internal.use((socket, next) => {
    const secret = socket.handshake.headers["x-internal-secret"];
    if (secret === apiConfig.internalSecret) next();
    else next(new Error("unauthorized"));
  });

  internal.on("connection", (socket) => {
    socket.on(EVENTS.aracKonum, async (payload: AracKonumPayload) => {
      if (!payload?.vehicles?.length) return;
      await upsertVehicles(payload.vehicles);
      io.to(`hat:${payload.hatSlug}`).emit(EVENTS.aracKonum, payload);
      io.emit(EVENTS.aracKonum, payload);
    });
  });
}
