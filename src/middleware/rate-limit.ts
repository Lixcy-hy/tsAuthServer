import type { Context, Next } from "hono";
import { redis } from "../lib/redis";
import { fail } from "../lib/response";

/**
 * 滑动窗口限流（Redis 固定窗口实现，简单够用）
 * key 形如 "rl:<bucket>:<id>"
 */
export async function rateLimit(opts: {
  bucket: string;
  id: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const { bucket, id, limit, windowSeconds } = opts;
  const key = `rl:${bucket}:${id}`;
  const fullWindow = Math.floor(Date.now() / 1000 / windowSeconds);
  const windowKey = `${key}:${fullWindow}`;

  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.expire(windowKey, windowSeconds + 1);
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
  };
}

/**
 * 限流中间件工厂
 */
export function rateLimitMiddleware(opts: {
  bucket: string;
  limit: number;
  windowSeconds: number;
  getId: (c: Context) => string | null;
}) {
  return async (c: Context, next: Next) => {
    const id = opts.getId(c);
    if (!id) return next();

    const result = await rateLimit({
      bucket: opts.bucket,
      id,
      limit: opts.limit,
      windowSeconds: opts.windowSeconds,
    });

    if (!result.allowed) {
      return fail(c, 429, "请求过于频繁");
    }

    return next();
  };
}
