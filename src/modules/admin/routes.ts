import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { adminService, AdminError } from "./service";
import { fail, ok } from "../../lib/response";
import { adminAuthMiddleware } from "../../middleware/admin-auth";

const createUserSchema = z.object({
  account: z.string().min(2, "账号至少2个字符").max(64),
  password: z.string().min(6, "密码至少6个字符"),
  name: z.string().max(128).optional().default(""),
  role: z.enum(["USER", "ADMIN"]).optional().default("USER"),
});

const updateUserSchema = z.object({
  name: z.string().max(128).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  password: z.string().min(6).optional(),
});

function handleAdminError(c: any, err: unknown) {
  if (err instanceof AdminError) {
    return fail(c, err.code, err.message);
  }
  console.error("[admin] unexpected error:", err);
  return fail(c, 500, "服务器异常");
}

export const adminRoutes = new Hono()
  .use("*", adminAuthMiddleware)
  // 获取用户列表
  .get("/users", async (c) => {
    try {
      const page = Number(c.req.query("page") || "1");
      const pageSize = Number(c.req.query("pageSize") || "20");
      const keyword = c.req.query("keyword") || "";
      const result = await adminService.listUsers({ page, pageSize, keyword });
      return ok(c, result);
    } catch (err) {
      return handleAdminError(c, err);
    }
  })
  // 创建用户
  .post("/users", zValidator("json", createUserSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const user = await adminService.createUser(input);
      return ok(c, user);
    } catch (err) {
      return handleAdminError(c, err);
    }
  })
  // 更新用户（名称、状态、密码）
  .patch("/users/:id", zValidator("json", updateUserSchema), async (c) => {
    try {
      const id = c.req.param("id");
      const input = c.req.valid("json");
      const user = await adminService.updateUser(id, input);
      return ok(c, user);
    } catch (err) {
      return handleAdminError(c, err);
    }
  })
  // 删除用户
  .delete("/users/:id", async (c) => {
    try {
      const id = c.req.param("id");
      await adminService.deleteUser(id);
      return ok(c, null);
    } catch (err) {
      return handleAdminError(c, err);
    }
  })
  // 获取统计信息
  .get("/stats", async (c) => {
    try {
      const stats = await adminService.getStats();
      return ok(c, stats);
    } catch (err) {
      return handleAdminError(c, err);
    }
  })
  // Bootstrap: 首次部署时把普通用户提升为管理员
  // 只在系统没有任何 ADMIN 时可用
  .post(
    "/bootstrap",
    zValidator(
      "json",
      z.object({
        account: z.string().min(1),
        bootstrapSecret: z.string().min(1),
      }),
    ),
    async (c) => {
      try {
        const { account, bootstrapSecret } = c.req.valid("json");
        const user = await adminService.bootstrapAdmin(
          account,
          bootstrapSecret,
        );
        return ok(c, user);
      } catch (err) {
        return handleAdminError(c, err);
      }
    },
  );
