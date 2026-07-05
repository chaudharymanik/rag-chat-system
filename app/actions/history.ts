"use server";

import { getHistoryStore } from "@/lib/history";
import { clearNamespace } from "@/lib/retrieval";

export async function clearConversation(sessionId: string): Promise<boolean> {
  try {
    await Promise.all([getHistoryStore().clear(sessionId), clearNamespace(sessionId)]);
    return true;
  } catch (error) {
    console.error("Failed to clear conversation history:", error);
    return false;
  }
}
