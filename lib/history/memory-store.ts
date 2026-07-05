import type { ChatHistoryStore, ChatMessage } from "../types";

declare global {
  var __ragChatMemoryStore: Map<string, ChatMessage[]> | undefined;
}

// Falls back to this when no Redis connection is configured. State only
// survives for the lifetime of the process, so history resets on redeploy.
export class MemoryHistoryStore implements ChatHistoryStore {
  private store: Map<string, ChatMessage[]>;

  constructor() {
    if (!globalThis.__ragChatMemoryStore) {
      globalThis.__ragChatMemoryStore = new Map();
    }
    this.store = globalThis.__ragChatMemoryStore;
  }

  async append(sessionId: string, message: ChatMessage): Promise<void> {
    const existing = this.store.get(sessionId) ?? [];
    existing.push(message);
    this.store.set(sessionId, existing);
  }

  async list(sessionId: string, limit = 20): Promise<ChatMessage[]> {
    const messages = this.store.get(sessionId) ?? [];
    return messages.slice(-limit);
  }

  async clear(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}
