import postgres from "postgres";
import { config } from "../config";

const searchPath = Bun.env.PG_SCHEMA || "mocklocation";

export const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 10,
  connect_timeout: 30,
  connection: {
    search_path: searchPath,
  },
  onnotice: () => {},
});

// 启动时输出当前 schema，便于排查走错库的问题
sql`SHOW search_path`
  .then((rows) => {
    console.log("[postgres] search_path =", rows[0]?.search_path);
  })
  .catch((err) => {
    console.error("[postgres] search_path query failed:", err.message);
  });
