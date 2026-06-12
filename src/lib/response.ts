import type { Context } from "hono";

/**
 * 统一响应结构：{ code, message, data }
 * 业务错误 HTTP 200 + code != 0，App 只看 code 和 message。
 */
export function ok<T>(c: Context, data: T, message = "ok") {
  return c.json({ code: 0, message, data });
}

export function fail(
  c: Context,
  code: number,
  message: string,
  data: unknown = null,
) {
  return c.json({ code, message, data });
}
