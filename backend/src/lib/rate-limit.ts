
import { redis } from "../db/redis.js";

export async function checkRateLimit(
  key: string,
  maximum: number,
  windowSeconds: number
): Promise<boolean> {
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  return count <= maximum;
}