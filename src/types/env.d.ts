export {};

/**
 * Hono 上下文变量类型声明（模块扩充）
 * 通过 c.set("userId", ...) / c.get("userId") 存取自定义变量
 */
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    tokenHash: string;
  }
}

/**
 * Bun.env 类型声明
 */
declare module "bun" {
  interface Env {
    APP_PORT?: string;
    APP_VERSION?: string;
    DATABASE_URL?: string;
    REDIS_URL?: string;
    TOKEN_SECRET?: string;
    TOKEN_EXPIRE_DAYS?: string;
    AMAP_KEY?: string;
    PLACE_SEARCH_LIMIT_PER_MINUTE?: string;
    LOGIN_LIMIT_PER_MINUTE?: string;
  }
}
