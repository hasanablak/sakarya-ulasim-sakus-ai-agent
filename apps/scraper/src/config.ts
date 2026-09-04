import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import {
  SAKUS_API_BASE_URL,
  SAKUS_BASE_URL,
} from "@sakus/shared";

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

export const scraperConfig = {
  sakusBase: process.env.SAKUS_BASE_URL ?? SAKUS_BASE_URL,
  sakusApi: process.env.SAKUS_API_BASE_URL ?? SAKUS_API_BASE_URL,
  apiPublic: process.env.API_PUBLIC_URL ?? "http://127.0.0.1:3001",
  internalSecret: process.env.INTERNAL_SECRET ?? "dev-internal-secret",
  headless: process.env.PUPPETEER_HEADLESS !== "false",
  ingestDelayMs: Number(process.env.INGEST_DELAY_MS ?? 1800),
  workerPort: Number(process.env.SCRAPER_PORT ?? 3102),
  chromePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
};

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

export function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}
