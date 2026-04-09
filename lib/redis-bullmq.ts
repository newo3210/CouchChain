import IORedis from "ioredis";
import type { ConnectionOptions } from "bullmq";

/**
 * Conexión BullMQ / ioredis. Con REDIS_URL (p. ej. Upstash rediss://) usa TLS correctamente.
 */
export function getBullmqConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    return new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}
