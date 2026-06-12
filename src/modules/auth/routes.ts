import type { Context } from "hono";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { config } from "../../config";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import { fail, ok } from "../../lib/response";
import { AuthError, authService } from "./service";

const loginSchema = z.object({
  account: z.string().min(1, "账号不能为空"),
  password: z.string().min(1, "密码不能为空"),
});

const verifySchema = z.object({
  token: z.string().min(1, "token 不能为空"),
});

function handleAuthError(c: Context, err: unknown) {
  if (err instanceof AuthError) {
    return fail(c, err.code, err.message);
  }
  console.error("[auth] unexpected error:", err);
  return fail(c, 500, "服务器异常");
}

export const authRoutes = new Hono()
  // 登录：按 IP + 账号联合限流
  .post(
    "/login",
    rateLimitMiddleware({
      bucket: "login",
      limit: config.loginLimitPerMinute,
      windowSeconds: 60,
      getId: (c) => {
        const ip =
          c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
          c.req.header("x-real-ip") ||
          "unknown";
        return ip;
      },
    }),
    zValidator("json", loginSchema),
    async (c) => {
      try {
        const { account, password } = c.req.valid("json");
        const result = await authService.login(account, password);
        return ok(c, result);
      } catch (err) {
        return handleAuthError(c, err);
      }
    },
  )

  // 验证 token（App 启动时调用）
  .post("/verify", zValidator("json", verifySchema), async (c) => {
    try {
      const { token } = c.req.valid("json");
      const result = await authService.verify(token);
      if (!result.authorized) {
        return fail(c, 401, "登录已失效，请重新登录", result);
      }
      return ok(c, result);
    } catch (err) {
      console.error("[auth] verify error:", err);
      return fail(c, 500, "服务器异常");
    }
  })

  // 退出登录：需要鉴权
  .use("/logout", authMiddleware)
  .post("/logout", async (c) => {
    try {
      const tokenHash = c.get("tokenHash") as string;
      await authService.logout(tokenHash);
      return ok(c, null);
    } catch (err) {
      console.error("[auth] logout error:", err);
      return fail(c, 500, "服务器异常");
    }
  })

  // 刷新 token：需要鉴权
  .use("/refresh", authMiddleware)
  .post("/refresh", async (c) => {
    try {
      const tokenHash = c.get("tokenHash") as string;
      const userId = c.get("userId") as string;
      const result = await authService.refresh(tokenHash, userId);
      return ok(c, result);
    } catch (err) {
      return handleAuthError(c, err);
    }
  });
