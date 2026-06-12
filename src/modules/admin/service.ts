import bcrypt from "bcryptjs";
import { sql } from "../../lib/postgres";

export interface AdminUser {
  id: string;
  account: string;
  name: string;
  status: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export class AdminError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

export const adminService = {
  async listUsers(params: { page: number; pageSize: number; keyword: string }) {
    const { page, pageSize, keyword } = params;
    const offset = (page - 1) * pageSize;

    let users: AdminUser[];
    let total: number;

    if (keyword) {
      const like = `%${keyword}%`;
      users = await sql<AdminUser[]>`
        SELECT id, account, name, status, role, created_at, updated_at
        FROM users
        WHERE account ILIKE ${like} OR name ILIKE ${like}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      const countResult = await sql<[{ count: number }]>`
        SELECT COUNT(*) as count FROM users
        WHERE account ILIKE ${like} OR name ILIKE ${like}
      `;
      total = countResult[0].count;
    } else {
      users = await sql<AdminUser[]>`
        SELECT id, account, name, status, role, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      const countResult = await sql<
        [{ count: number }]
      >`SELECT COUNT(*) as count FROM users`;
      total = countResult[0].count;
    }

    return {
      users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async createUser(input: {
    account: string;
    password: string;
    name?: string;
    role?: string;
  }) {
    const { account, password, name = "", role = "USER" } = input;

    // 检查是否已存在
    const existing = await sql<
      [{ id: string }]
    >`SELECT id FROM users WHERE account = ${account}`;
    if (existing.length > 0) {
      throw new AdminError(409, "账号已存在");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await sql<AdminUser[]>`
      INSERT INTO users (account, password_hash, name, status, role)
      VALUES (${account}, ${passwordHash}, ${name}, 'ACTIVE', ${role})
      RETURNING id, account, name, status, role, created_at, updated_at
    `;
    return result[0];
  },

  async updateUser(
    id: string,
    input: {
      name?: string;
      status?: string;
      password?: string;
      role?: string;
    },
  ) {
    const user = await sql<
      AdminUser[]
    >`SELECT id, account FROM users WHERE id = ${id}`;
    if (user.length === 0) {
      throw new AdminError(404, "用户不存在");
    }

    // 保护：至少保留一个 ADMIN
    if (input.role && input.role !== "ADMIN") {
      const remaining = await sql<[{ count: number }]>`
        SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id != ${id}
      `;
      if (remaining[0].count === 0) {
        throw new AdminError(400, "系统至少需要一个管理员");
      }
    }

    let result: AdminUser[];

    if (input.password) {
      // 更新密码
      const passwordHash = await bcrypt.hash(input.password, 10);
      result = await sql<AdminUser[]>`
        UPDATE users
        SET password_hash = ${passwordHash}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, account, name, status, role, created_at, updated_at
      `;
    } else if (input.status) {
      // 更新状态
      // 保护：不能禁用最后一个 ADMIN
      if (input.status === "DISABLED") {
        const current = await sql<
          [{ role: string }]
        >`SELECT role FROM users WHERE id = ${id}`;
        if (current[0]?.role === "ADMIN") {
          const remaining = await sql<[{ count: number }]>`
            SELECT COUNT(*) as count FROM users
            WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id != ${id}
          `;
          if (remaining[0].count === 0) {
            throw new AdminError(400, "不能禁用最后一个管理员");
          }
        }
      }
      result = await sql<AdminUser[]>`
        UPDATE users
        SET status = ${input.status}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, account, name, status, role, created_at, updated_at
      `;
    } else if (input.role) {
      // 更新角色
      result = await sql<AdminUser[]>`
        UPDATE users
        SET role = ${input.role}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, account, name, status, role, created_at, updated_at
      `;
    } else if (input.name !== undefined) {
      // 更新名称
      result = await sql<AdminUser[]>`
        UPDATE users
        SET name = ${input.name}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, account, name, status, role, created_at, updated_at
      `;
    } else {
      // 无更新
      result = await sql<AdminUser[]>`
        SELECT id, account, name, status, role, created_at, updated_at FROM users WHERE id = ${id}
      `;
    }

    return result[0];
  },

  async deleteUser(id: string) {
    const user = await sql<
      AdminUser[]
    >`SELECT id, account, role FROM users WHERE id = ${id}`;
    if (user.length === 0) {
      throw new AdminError(404, "用户不存在");
    }

    // 保护：不能删除最后一个 ADMIN
    if (user[0].role === "ADMIN") {
      const remaining = await sql<[{ count: number }]>`
        SELECT COUNT(*) as count FROM users
        WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id != ${id}
      `;
      if (remaining[0].count === 0) {
        throw new AdminError(400, "不能删除最后一个管理员");
      }
    }

    // 删除用户的 token 和搜索日志（级联删除会处理）
    await sql`DELETE FROM users WHERE id = ${id}`;
  },

  /**
   * Bootstrap: 把指定账号升级为 ADMIN（仅在系统没有任何 ADMIN 时可用）
   * 用于首次部署时建立第一个管理员
   */
  async bootstrapAdmin(account: string, bootstrapSecret: string) {
    // 校验 bootstrap 密钥
    const expected = Bun.env.ADMIN_BOOTSTRAP_SECRET;
    if (!expected) {
      throw new AdminError(403, "未配置 bootstrap 密钥");
    }
    if (bootstrapSecret !== expected) {
      throw new AdminError(403, "bootstrap 密钥错误");
    }

    // 检查系统是否已有 ADMIN
    const existing = await sql<[{ count: number }]>`
      SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'
    `;
    if (existing[0].count > 0) {
      throw new AdminError(400, "系统已有管理员，请使用现有管理员升级他人");
    }

    // 提升指定账号
    const user = await sql<
      AdminUser[]
    >`SELECT id FROM users WHERE account = ${account}`;
    if (user.length === 0) {
      throw new AdminError(404, "账号不存在，请先注册");
    }

    const result = await sql<AdminUser[]>`
      UPDATE users
      SET role = 'ADMIN', updated_at = NOW()
      WHERE account = ${account}
      RETURNING id, account, name, status, role, created_at, updated_at
    `;
    return result[0];
  },

  async getStats() {
    const [userCount, activeUserCount, adminCount, tokenCount, searchCount] =
      await Promise.all([
        sql<[{ count: number }]>`SELECT COUNT(*) as count FROM users`,
        sql<
          [{ count: number }]
        >`SELECT COUNT(*) as count FROM users WHERE status = 'ACTIVE'`,
        sql<
          [{ count: number }]
        >`SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'`,
        sql<
          [{ count: number }]
        >`SELECT COUNT(*) as count FROM access_tokens WHERE revoked_at IS NULL`,
        sql<
          [{ count: number }]
        >`SELECT COUNT(*) as count FROM place_search_logs WHERE created_at > NOW() - INTERVAL '24 hours'`,
      ]);

    return {
      users: userCount[0].count,
      activeUsers: activeUserCount[0].count,
      admins: adminCount[0].count,
      activeTokens: tokenCount[0].count,
      searchesLast24h: searchCount[0].count,
    };
  },
};
