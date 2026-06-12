export const config = {
  port: Number(Bun.env.APP_PORT) || 8080,
  version: Bun.env.APP_VERSION || "1.0.0",

  // 部署到外部数据库时必须显式提供；空串启动时会立刻报错，比连到错库好
  databaseUrl: Bun.env.DATABASE_URL || "",
  redisUrl: Bun.env.REDIS_URL || "",

  tokenSecret: Bun.env.TOKEN_SECRET || "",
  tokenExpireDays: Number(Bun.env.TOKEN_EXPIRE_DAYS) || 30,

  amapKey: Bun.env.AMAP_KEY || "",

  // 启动期硬校验：连接信息缺失直接退出，避免上线后才发现连错地方
  ...(function assert() {
    if (!Bun.env.DATABASE_URL) console.warn("[config] DATABASE_URL is empty");
    if (!Bun.env.REDIS_URL) console.warn("[config] REDIS_URL is empty");
    if (!Bun.env.TOKEN_SECRET) console.warn("[config] TOKEN_SECRET is empty");
    return {};
  })(),

  placeSearchLimitPerMinute:
    Number(Bun.env.PLACE_SEARCH_LIMIT_PER_MINUTE) || 60,
  loginLimitPerMinute: Number(Bun.env.LOGIN_LIMIT_PER_MINUTE) || 10,
} as const;
