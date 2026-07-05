import { Redis } from "@upstash/redis";
import type { ChatHistoryStore, ChatMessage } from "../types";

export class RedisHistoryStore implements ChatHistoryStore {
  private client: Redis;

  constructor() {
    this.client = Redis.fromEnv();
  }

  async append(sessionId: string, message: ChatMessage): Promise<void> {
    await this.client.rpush(this.key(sessionId), JSON.stringify(message));
  }

  async list(sessionId: string, limit = 20): Promise<ChatMessage[]> {
    const raw = await this.client.lrange<string>(this.key(sessionId), -limit, -1);
    return raw.map((entry) => (typeof entry === "string" ? JSON.parse(entry) : entry));
  }

  async clear(sessionId: string): Promise<void> {
    await this.client.del(this.key(sessionId));
  }

  private key(sessionId: string): string {
    return `rag-chat:session:${sessionId}`;
  }
}
