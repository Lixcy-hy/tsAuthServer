import Redis from "ioredis";
import { config } from "../config";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on("connect", () => {
  console.log("[redis] connected");
});

redis.on("error", (err) => {
  console.error("[redis] error:", err.message);
  console.error(
    "[redis] full error:",
    JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
  );
});
