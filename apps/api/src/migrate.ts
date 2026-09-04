import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { pool, ensureDatabase } from "./db.js";

async function addColumnIfMissing(table: string, column: string, definition: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (Number(rows[0]?.c) === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  }
}

async function addIndexIfMissing(table: string, index: string, ddl: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index],
  );
  if (Number(rows[0]?.c) === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD ${ddl}`);
  }
}

async function ensureWebchatEmbedKeys(): Promise<void> {
  await addColumnIfMissing("webchatler", "embed_key", "embed_key CHAR(36) NULL");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM webchatler WHERE embed_key IS NULL OR embed_key = ''`,
  );
  for (const row of rows) {
    await pool.execute(`UPDATE webchatler SET embed_key = ? WHERE id = ?`, [randomUUID(), row.id]);
  }
  await addIndexIfMissing("webchatler", "uq_webchat_embed", "UNIQUE KEY uq_webchat_embed (embed_key)");
}

export async function migrate(): Promise<void> {
  await ensureDatabase();
  const sqlPath = resolve(dirname(fileURLToPath(import.meta.url)), "schema.sql");
  const raw = await readFile(sqlPath, "utf8");
  const statements = raw
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  await addColumnIfMissing("sohbet_oturumlari", "webchat_id", "webchat_id INT NULL");
  await addColumnIfMissing("sohbet_oturumlari", "agent_id", "agent_id INT NULL");
  await addColumnIfMissing("sohbet_oturumlari", "host_origin", "host_origin VARCHAR(255) NULL");
  await addIndexIfMissing("sohbet_oturumlari", "idx_sohbet_webchat", "KEY idx_sohbet_webchat (webchat_id, updated_at)");
  await addColumnIfMissing("sohbet_mesajlari", "tool_ad", "tool_ad VARCHAR(64) NULL");
  await addColumnIfMissing("sohbet_mesajlari", "fonksiyon_kod", "fonksiyon_kod VARCHAR(64) NULL");
  await ensureWebchatEmbedKeys();
}
