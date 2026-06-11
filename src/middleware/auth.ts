import type { Context, Next } from "hono";
import { hashToken, isTokenRevoked } from "../lib/token";
import { sql } from "../lib/postgres";
import { fail } from "../lib/response";

/**
 * Bearer Token 鉴权中间件
 * 从 Authorization: Bearer <token> 提取 token，查 DB 验证有效性。
 * 验证通过后把 userId 放到 c.set("userId", ...)。
 */
export async function authMiddleware(c: Context, next: Next) {
  const auth = c.req.header("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return fail(c, 401, "登录已失效，请重新登录");
  }

  const token = match[1].trim();
  if (!token) {
    return fail(c, 401, "登录已失效，请重新登录");
  }

  const tokenHash = hashToken(token);

  // 检查撤销标记
  if (await isTokenRevoked(tokenHash)) {
    return fail(c, 401, "登录已失效，请重新登录");
  }

  // 查 DB 验证
  const rows = await sql<
    Array<{ user_id: string; expires_at: Date; revoked_at: Date | null; status: string }>
  >`
    SELECT at.user_id, at.expires_at, at.revoked_at, u.status
    FROM access_tokens at
    JOIN users u ON u.id = at.user_id
    WHERE at.token_hash = ${tokenHash}
      AND at.revoked_at IS NULL
      AND at.expires_at > NOW()
      AND u.status = 'ACTIVE'
    LIMIT 1
  `;

  if (rows.length === 0) {
    return fail(c, 401, "登录已失效，请重新登录");
  }

  c.set("userId", rows[0].user_id);
  c.set("tokenHash", tokenHash);

  return next();
}
