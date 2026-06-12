import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { appService } from "./service";
import { fail, ok } from "../../lib/response";

const querySchema = z.object({
  platform: z.literal("android").or(z.string().min(1)),
  packageName: z.string().min(1, "packageName 不能为空"),
  versionName: z.string().min(1, "versionName 不能为空"),
  versionCode: z.coerce.number().int().nonnegative("versionCode 不合法"),
});

export const appRoutes = new Hono().get(
  "/update",
  zValidator("query", querySchema),
  async (c) => {
    try {
      const { platform, packageName, versionCode } = c.req.valid("query");
      const result = await appService.checkUpdate(
        platform,
        packageName,
        versionCode,
      );
      return ok(c, result);
    } catch (err) {
      console.error("[app/update] unexpected error:", err);
      return fail(c, 500, "服务器异常");
    }
  },
);
