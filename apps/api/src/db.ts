import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { apiConfig } from "./config.js";

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function ensureDatabase(): Promise<void> {
  const { database, ...conn } = apiConfig.mysql;
  const name = database.replace(/`/g, "");
  const attempts = 20;
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    const boot = createPool({
      ...conn,
      database: undefined,
      waitForConnections: true,
      connectionLimit: 1,
    });
    try {
      await boot.query(
        `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      await boot.end();
      return;
    } catch (err) {
      lastErr = err;
      await boot.end().catch(() => undefined);
      if (i < attempts) await sleep(1500);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `MySQL'e bağlanılamadı veya sakus_ai oluşturulamadı: ${msg}. Docker Desktop açıkken \`docker compose up -d\` çalıştır, .env için .env.example dosyasına bak (port 3307, kullanıcı sakus).`,
  );
}

export const pool: Pool = createPool({
  ...apiConfig.mysql,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z",
});

export async function query<T extends RowDataPacket[]>(sql: string, params?: Record<string, unknown> | unknown[]): Promise<T> {
  const [rows] = await pool.query<T>(sql, params);
  return rows;
}

export async function exec(sql: string, params?: Record<string, unknown> | unknown[]): Promise<ResultSetHeader> {
  const [res] = await pool.execute<ResultSetHeader>(sql, params);
  return res;
}
