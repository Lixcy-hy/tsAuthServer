import { Hono } from "hono";
import { serveStatic } from "hono/bun";

const staticRoutes = new Hono()
  // 管理页面
  .get("/", serveStatic({ path: "./public/admin.html" }))
  .get("/index.html", serveStatic({ path: "./public/admin.html" }));

export { staticRoutes };
