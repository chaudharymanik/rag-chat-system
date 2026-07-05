"use server";

import { getHistoryStore } from "@/lib/history";
import { clearNamespace } from "@/lib/retrieval";
import type { ChatMessage } from "@/lib/types";

export async function loadConversation(sessionId: string): Promise<ChatMessage[]> {
  try {
    return await getHistoryStore().list(sessionId);
  } catch (error) {
    console.error("Failed to load conversation history:", error);
    return [];
  }
}

export async function clearConversation(sessionId: string): Promise<boolean> {
  try {
    await Promise.all([getHistoryStore().clear(sessionId), clearNamespace(sessionId)]);
    return true;
  } catch (error) {
    console.error("Failed to clear conversation history:", error);
    return false;
  }
}
