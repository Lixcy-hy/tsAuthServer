import { createHash, randomUUID } from "node:crypto";
import { config } from "../config";
import { redis } from "../lib/redis";

/**
 * 生成 token（明文给 App）+ token_hash（存库）
 * 明文格式：<random>.<hmac_short>
 * 这样 hash 长度可控且不可逆。
 */
export function generateToken(userId: string): { token: string; tokenHash: string } {
  const random = randomUUID().replace(/-/g, "");
  const fingerprint = createHash("sha256")
    .update(`${userId}.${config.tokenSecret}.${random}`)
    .digest("hex")
    .slice(0, 16);
  const token = `${random}.${fingerprint}`;
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const REVOKE_MARKER = "revoked";

/**
 * 验证 token：查 Redis 和 DB（这里用 Redis 缓存，DB 在 service 层校验）
 * 如果已撤销返回 null。
 */
export async function isTokenRevoked(tokenHash: string): Promise<boolean> {
  const v = await redis.get(`token:revoked:${tokenHash}`);
  return v === REVOKE_MARKER;
}

export async function markTokenRevoked(tokenHash: string): Promise<void> {
  // 撤销标记保留 90 天，足够覆盖最长 token 有效期
  await redis.set(`token:revoked:${tokenHash}`, REVOKE_MARKER, "EX", 90 * 24 * 3600);
}
