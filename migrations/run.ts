import { sql } from "../src/lib/postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const migrationPath = resolve(import.meta.dir, "001_init.sql");
  const sqlContent = readFileSync(migrationPath, "utf-8");

  console.log("[migrate] running 001_init.sql ...");
  try {
    await sql.unsafe(sqlContent);
    console.log("[migrate] done");
  } catch (err) {
    console.error("[migrate] failed:", err);
    process.exit(1);
  }
  await sql.end();
}

main();
