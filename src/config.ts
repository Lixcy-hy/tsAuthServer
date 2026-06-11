export const config = {
  port: Number(Bun.env.APP_PORT) || 8080,
  version: Bun.env.APP_VERSION || "1.0.0",

  databaseUrl: Bun.env.DATABASE_URL || "postgres://postgres:password@localhost:5432/location_service",
  redisUrl: Bun.env.REDIS_URL || "redis://localhost:6379/0",

  tokenSecret: Bun.env.TOKEN_SECRET || "change-me",
  tokenExpireDays: Number(Bun.env.TOKEN_EXPIRE_DAYS) || 30,

  amapKey: Bun.env.AMAP_KEY || "",

  placeSearchLimitPerMinute: Number(Bun.env.PLACE_SEARCH_LIMIT_PER_MINUTE) || 60,
  loginLimitPerMinute: Number(Bun.env.LOGIN_LIMIT_PER_MINUTE) || 10,
} as const;
