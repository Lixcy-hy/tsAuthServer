import { Hono } from "hono";
import { sql } from "../../lib/postgres";
import { redis } from "../../lib/redis";
import { ok, fail } from "../../lib/response";
import { config } from "../../config";

export const healthRoutes = new Hono().get("/", async (c) => {
  let pgOk = false;
  let redisOk = false;

  try {
    await sql`SELECT 1`;
    pgOk = true;
  } catch {}
  try {
    await redis.ping();
    redisOk = true;
  } catch {}

  const data = {
    status: pgOk && redisOk ? "up" : "degraded",
    time: new Date().toISOString(),
    version: config.version,
    services: { postgres: pgOk, redis: redisOk },
  };

  return pgOk && redisOk ? ok(c, data) : fail(c, 503, "服务降级", data);
});
