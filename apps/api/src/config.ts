import { existsSync } from "node:fs";
import { userInfo } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

function loadEnv(): void {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
    resolve(process.cwd(), "../../.env"),
    resolve(here, "../../../.env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      config({ path: p, override: true });
      return;
    }
  }
}

loadEnv();

export const apiConfig = {
  port: Number(process.env.API_PORT ?? 3001),
  internalSecret: process.env.INTERNAL_SECRET ?? "dev-internal-secret",
    adminPassword: process.env.ADMIN_PASSWORD || "admin",
  mysql: {
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? 3307),
    user: process.env.MYSQL_USER || userInfo().username || "sakus",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "sakus_ai",
  },
  scraperDir: resolve(fileURLToPath(new URL(".", import.meta.url)), "../../scraper"),
  scraperUrl: process.env.SCRAPER_URL ?? "http://127.0.0.1:3102",
};
