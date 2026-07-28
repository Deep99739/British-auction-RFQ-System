import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db/pool.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const pool = createPool({
  ...config,
  databaseUrl: config.databaseUrlUnpooled || config.databaseUrl,
});

try {
  const seedSql = await readFile(
    join(currentDirectory, "..", "database", "seed.sql"),
    "utf8"
  );
  await pool.query(seedSql);
  console.log("Seed data applied.");
} finally {
  await pool.end();
}
