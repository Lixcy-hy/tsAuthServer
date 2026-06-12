import bcrypt from "bcryptjs";
import { sql } from "../../lib/postgres";
import { generateToken, hashToken, markTokenRevoked } from "../../lib/token";
import { config } from "../../config";

export interface UserRow {
  id: string;
  account: string;
  password_hash: string;
  name: string;
  status: "ACTIVE" | "DISABLED";
  created_at: Date;
  updated_at: Date;
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: { id: string; account: string; name: string };
}

export class AuthError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

export const authService = {
  async login(account: string, password: string): Promise<LoginResult> {
    if (!account || !password) {
      throw new AuthError(400, "账号或密码不能为空");
    }

    const rows = await sql<UserRow[]>`
      SELECT id, account, password_hash, name, status, created_at, updated_at
      FROM users
      WHERE account = ${account}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new AuthError(401, "账号或密码错误");
    }

    const user = rows[0];

    if (user.status !== "ACTIVE") {
      throw new AuthError(403, "账号已禁用");
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new AuthError(401, "账号或密码错误");
    }

    // 单设备登录：撤销该用户所有未过期的旧 token，同时在 Redis 标记
    const oldTokenRows = await sql<Array<{ token_hash: string }>>`
      UPDATE access_tokens
      SET revoked_at = NOW()
      WHERE user_id = ${user.id} AND revoked_at IS NULL
      RETURNING token_hash
    `;
    for (const old of oldTokenRows) {
      await markTokenRevoked(old.token_hash);
    }

    // 颁发新 token
    const { token, tokenHash } = generateToken(user.id);
    const expiresAt = new Date(
      Date.now() + config.tokenExpireDays * 24 * 3600 * 1000,
    );

    await sql`
      INSERT INTO access_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${expiresAt})
    `;

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        account: user.account,
        name: user.name,
      },
    };
  },

  async verify(
    token: string,
  ): Promise<{ authorized: boolean; expiresAt: string | null }> {
    if (!token) {
      return { authorized: false, expiresAt: null };
    }

    const tokenHash = hashToken(token);

    const rows = await sql<
      Array<{ expires_at: Date; revoked_at: Date | null; status: string }>
    >`
      SELECT at.expires_at, at.revoked_at, u.status
      FROM access_tokens at
      JOIN users u ON u.id = at.user_id
      WHERE at.token_hash = ${tokenHash}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return { authorized: false, expiresAt: null };
    }

    const row = rows[0];
    if (row.revoked_at) {
      return { authorized: false, expiresAt: null };
    }
    if (row.status !== "ACTIVE") {
      return { authorized: false, expiresAt: null };
    }
    if (row.expires_at.getTime() <= Date.now()) {
      return { authorized: false, expiresAt: null };
    }

    return {
      authorized: true,
      expiresAt: row.expires_at.toISOString(),
    };
  },

  async logout(tokenHash: string): Promise<void> {
    // 软删除 + Redis 撤销标记
    await sql`
      UPDATE access_tokens
      SET revoked_at = NOW()
      WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
    `;
    await markTokenRevoked(tokenHash);
  },

  async refresh(tokenHash: string, userId: string): Promise<LoginResult> {
    // 撤销旧 token
    await this.logout(tokenHash);

    // 颁发新 token
    const { token, tokenHash: newHash } = generateToken(userId);
    const expiresAt = new Date(
      Date.now() + config.tokenExpireDays * 24 * 3600 * 1000,
    );

    await sql`
      INSERT INTO access_tokens (user_id, token_hash, expires_at)
      VALUES (${userId}, ${newHash}, ${expiresAt})
    `;

    const rows = await sql<
      Array<{ id: string; account: string; name: string }>
    >`
      SELECT id, account, name FROM users WHERE id = ${userId} LIMIT 1
    `;

    const user = rows[0];

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, account: user.account, name: user.name },
    };
  },

  /**
   * 用于初始化/seed 的工具方法
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  },
};
