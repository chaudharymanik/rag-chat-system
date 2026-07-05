export type ChatRole = "user" | "assistant" | "error";

export type RetrievedChunk = {
  id: string;
  score: number;
  content: string;
  metadata?: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  sources?: RetrievedChunk[];
};

export interface ChatHistoryStore {
  append(sessionId: string, message: ChatMessage): Promise<void>;
  list(sessionId: string, limit?: number): Promise<ChatMessage[]>;
  clear(sessionId: string): Promise<void>;
}
