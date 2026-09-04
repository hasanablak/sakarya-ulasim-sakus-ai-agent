import Fastify from "fastify";
import cors from "@fastify/cors";
import { apiConfig } from "./config.js";
import { seedDefaultTools } from "./agent-store.js";
import { seedDefaultWebchat } from "./webchat-store.js";
import { migrate } from "./migrate.js";
import { registerRoutes } from "./routes.js";
import { attachSockets } from "./socket.js";

async function main(): Promise<void> {
  await migrate();
  await seedDefaultTools();
  await seedDefaultWebchat();
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await registerRoutes(app);
  await app.ready();
  attachSockets(app.server);
  await app.listen({ port: apiConfig.port, host: "0.0.0.0" });
  app.log.info(`API http://127.0.0.1:${apiConfig.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
