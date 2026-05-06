import IORedis from "ioredis";
import { ENV } from "@shared/env";

export const redis = new IORedis(ENV.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string | string[]): Promise<void>;
  invalidatePrefix(prefix: string): Promise<void>;
}

export const redisCache: CachePort = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  },
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  },
  async del(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      if (key.length === 0) return;
      await redis.del(...key);
    } else {
      await redis.del(key);
    }
  },
  async invalidatePrefix(prefix: string): Promise<void> {
    const stream = redis.scanStream({ match: `${prefix}*`, count: 200 });
    const pipeline = redis.pipeline();
    let queued = 0;
    for await (const keys of stream) {
      const arr = keys as string[];
      for (const k of arr) {
        pipeline.del(k);
        queued++;
      }
    }
    if (queued > 0) await pipeline.exec();
  },
};
