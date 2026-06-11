import type { Context, Next } from "hono";
import { hashToken, isTokenRevoked } from "../lib/token";
import { sql } from "../lib/postgres";
import { fail } from "../lib/response";

/**
 * 管理员鉴权中间件
 * 要求：用户必须登录 + status = 'ACTIVE' + role = 'ADMIN'
 * 只有 ADMIN 角色的用户才能访问管理接口
 */
export async function adminAuthMiddleware(c: Context, next: Next) {
  const auth = c.req.header("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return fail(c, 401, "请先登录");
  }

  const token = match[1].trim();
  if (!token) {
    return fail(c, 401, "请先登录");
  }

  const tokenHash = hashToken(token);

  if (await isTokenRevoked(tokenHash)) {
    return fail(c, 401, "登录已失效，请重新登录");
  }

  const rows = await sql<
    Array<{ user_id: string; account: string; status: string; role: string }>
  >`
    SELECT at.user_id, u.account, u.status, u.role
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

  // 检查是否是管理员
  if (rows[0].role !== "ADMIN") {
    return fail(c, 403, "权限不足，需要管理员账号");
  }

  c.set("userId", rows[0].user_id);
  c.set("adminAccount", rows[0].account);

  return next();
}
