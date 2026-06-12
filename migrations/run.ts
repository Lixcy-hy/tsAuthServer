import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "../src/lib/postgres";

async function main() {
  const migrationsDir = import.meta.dir;

  // 自动发现所有 NNN_xxx.sql，按文件名字典序执行（001 < 002 < ...）
  const files = readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort();

  if (files.length === 0) {
    console.log("[migrate] no migration files found");
    return;
  }

  for (const file of files) {
    const path = resolve(migrationsDir, file);
    const content = readFileSync(path, "utf-8");
    console.log(`[migrate] running ${file} ...`);
    try {
      await sql.unsafe(content);
      console.log(`[migrate] ${file} done`);
    } catch (err) {
      console.error(`[migrate] ${file} failed:`, err);
      process.exit(1);
    }
  }

  await sql.end();
  console.log("[migrate] all migrations applied");
}

main();
