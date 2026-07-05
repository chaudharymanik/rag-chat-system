import type { ChatHistoryStore } from "../types";
import { RedisHistoryStore } from "./redis-store";
import { MemoryHistoryStore } from "./memory-store";

let store: ChatHistoryStore | null = null;

export function getHistoryStore(): ChatHistoryStore {
  if (store) return store;

  const hasRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  store = hasRedis ? new RedisHistoryStore() : new MemoryHistoryStore();
  return store;
}
