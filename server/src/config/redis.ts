import Redis from 'ioredis';
import { config } from './environment';

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

export const getRedisClient = () => redis;

export const cacheGet = async (key: string) => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

export const cacheSet = async (key: string, value: any, ttl = 3600) => {
  await redis.setex(key, ttl, JSON.stringify(value));
};

export const cacheDel = async (key: string) => {
  await redis.del(key);
};

export const cacheFlush = async () => {
  await redis.flushdb();
};

export const sessionStore = {
  set: async (sessionId: string, data: any, ttl = 86400) => {
    await cacheSet(`session:${sessionId}`, data, ttl);
  },
  get: async (sessionId: string) => {
    return await cacheGet(`session:${sessionId}`);
  },
  destroy: async (sessionId: string) => {
    await cacheDel(`session:${sessionId}`);
  },
};
