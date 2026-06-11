import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { placesService, PlaceError } from "./service";
import { fail, ok } from "../../lib/response";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import { config } from "../../config";

const querySchema = z.object({
  keyword: z.string().min(1),
  city: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

export const placesRoutes = new Hono().use(
  "*",
  authMiddleware,
  // 鉴权后才能拿 userId 用于限流 key
  rateLimitMiddleware({
    bucket: "place_search",
    limit: config.placeSearchLimitPerMinute,
    windowSeconds: 60,
    getId: (c) => (c.get("userId") as string) || null,
  }),
).get("/search", zValidator("query", querySchema), async (c) => {
  try {
    const { keyword, city, limit } = c.req.valid("query");
    const userId = c.get("userId") as string;
    const items = await placesService.search({ keyword, city, limit, userId });
    return ok(c, { items });
  } catch (err) {
    if (err instanceof PlaceError) {
      return fail(c, err.code, err.message);
    }
    console.error("[places] unexpected error:", err);
    return fail(c, 500, "服务器异常");
  }
});
