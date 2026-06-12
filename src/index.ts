import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { authRoutes } from "./modules/auth";
import { placesRoutes } from "./modules/places";
import { healthRoutes } from "./modules/health";
import { adminRoutes, releaseAdminRoutes } from "./modules/admin";
import { staticRoutes } from "./modules/static";
import { appRoutes } from "./modules/app";
import { config } from "./config";
import { sql } from "./lib/postgres";
import { redis } from "./lib/redis";

async function checkConnections() {
  // PostgreSQL
  try {
    await sql`SELECT 1`;
    console.log("[boot] postgres ok");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[boot] postgres failed:", msg);
    console.error(
      "[boot] full error:",
      JSON.stringify(err, Object.getOwnPropertyNames(err || {}), 2),
    );
    process.exit(1);
  }

  // Redis
  try {
    const pong = await redis.ping();
    console.log(`[boot] redis ok (${pong})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[boot] redis failed:", msg);
    console.error(
      "[boot] full error:",
      JSON.stringify(err, Object.getOwnPropertyNames(err || {}), 2),
    );
    process.exit(1);
  }
}

await checkConnections();

const app = new Hono();

// ── 全局中间件 ──────────────────────────────────────────────────
app.use("*", requestId());
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

// ── 路由 ────────────────────────────────────────────────────────
app.route("/api/v1/health", healthRoutes);
app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/places", placesRoutes);
app.route("/api/v1/admin", adminRoutes);
app.route("/api/v1/admin", releaseAdminRoutes);
app.route("/api/v1/app", appRoutes);
app.route("/admin", staticRoutes);

// ── 全局错误兜底 ─────────────────────────────────────────────────
app.onError((err, c) => {
  console.error("[global] unhandled error:", err);
  return c.json({ code: 500, message: "服务器异常", data: null });
});

app.notFound((c) => {
  return c.json({ code: 404, message: "接口不存在", data: null });
});

// ── 启动 ─────────────────────────────────────────────────────────
console.log(`[server] starting on port ${config.port}`);
console.log(`[server] version ${config.version}`);

export default {
  port: config.port,
  fetch: app.fetch,
};
