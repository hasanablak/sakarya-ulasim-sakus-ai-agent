import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { apiConfig } from "./config.js";

const PREFIX = "sakus.v1.";

function secret(): string {
  return (apiConfig.adminPassword || "admin").trim();
}

export function issueAdminToken(): string {
  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", secret()).update(nonce).digest("hex");
  return `${PREFIX}${nonce}.${sig}`;
}

export function isAdminToken(token: string | undefined): boolean {
  if (!token?.startsWith(PREFIX)) return false;
  const rest = token.slice(PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot < 1) return false;
  const nonce = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  if (!/^[0-9a-f]+$/i.test(nonce) || !/^[0-9a-f]{64}$/i.test(sig)) return false;
  const expected = createHmac("sha256", secret()).update(nonce).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
