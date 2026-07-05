"use client";

import { useEffect, useRef, useState } from "react";
import { readStreamableValue } from "ai/rsc";
import { askQuestion } from "@/app/actions/chat";
import { clearConversation, loadConversation } from "@/app/actions/history";
import { uploadDocument } from "@/app/actions/upload";
import type { ChatMessage } from "@/lib/types";

function newId(): string {
  return crypto.randomUUID();
}

export function ChatPanel() {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<{ kind: "idle" | "uploading" | "error"; message?: string }>({
    kind: "idle",
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let id = localStorage.getItem("rag-chat-session-id");
    if (!id) {
      id = newId();
      localStorage.setItem("rag-chat-session-id", id);
    }
    setSessionId(id);
    loadConversation(id).then(setMessages);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;

    setUploadStatus({ kind: "uploading" });

    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("file", file);

    const result = await uploadDocument(formData);

    if (result.success) {
      setUploadedFiles((prev) => [...prev, result.fileName]);
      setUploadStatus({ kind: "idle" });
    } else {
      setUploadStatus({ kind: "error", message: result.error });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    const userMessage: ChatMessage = { id: newId(), role: "user", content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    const assistantId = newId();

    try {
      const { stream, sources } = await askQuestion(sessionId, nextMessages);
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", sources }]);

      let receivedAny = false;
      for await (const delta of readStreamableValue(stream)) {
        if (!delta) continue;
        receivedAny = true;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
        );
      }

      if (!receivedAny) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, role: "error", content: "No response was generated. Try again." }
              : m
          )
        );
      }
    } catch (error) {
      console.error("askQuestion failed:", error);
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "error", content: "Something went wrong. Try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (!sessionId) return;
    const ok = await clearConversation(sessionId);
    if (ok) {
      setMessages([]);
      setUploadedFiles([]);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
        <label className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500">
          Upload document
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf"
            onChange={handleUpload}
            disabled={uploadStatus.kind === "uploading"}
            className="hidden"
          />
        </label>
        <span className="text-xs text-zinc-500">.txt, .md, or .pdf — answers are scoped to what you upload</span>

        {uploadStatus.kind === "uploading" && <span className="text-xs text-zinc-400">Indexing…</span>}
        {uploadStatus.kind === "error" && (
          <span className="text-xs text-red-400">{uploadStatus.message}</span>
        )}
        {uploadedFiles.map((name) => (
          <span key={name} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
            {name}
          </span>
        ))}
      </div>

      <div className="flex min-h-[50vh] flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        {messages.length === 0 && (
          <p className="m-auto max-w-xs text-center text-sm text-zinc-500">
            Upload a document above, then ask a question about it.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto max-w-[80%] rounded-lg bg-zinc-700 px-3 py-2 text-sm"
                : message.role === "error"
                  ? "mr-auto max-w-[80%] rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300"
                  : "mr-auto max-w-[80%] rounded-lg bg-zinc-900 px-3 py-2 text-sm"
            }
          >
            <p className="whitespace-pre-wrap">{message.content || "…"}</p>

            {message.sources && message.sources.length > 0 && (
              <div className="mt-2 border-t border-zinc-800 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  {expanded[message.id] ? "Hide" : "Show"} {message.sources.length} source
                  {message.sources.length > 1 ? "s" : ""}
                </button>
                {expanded[message.id] && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {message.sources.map((source) => (
                      <li key={source.id} className="rounded bg-zinc-800 px-2 py-1 text-zinc-400">
                        <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                          <span>{(source.metadata?.source as string) ?? source.id}</span>
                          <span>score {source.score.toFixed(2)}</span>
                        </div>
                        <p className="line-clamp-2">{source.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the uploaded document(s)..."
          disabled={busy}
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-40"
        >
          {busy ? "..." : "Send"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={busy || (messages.length === 0 && uploadedFiles.length === 0)}
          className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
        >
          Clear
        </button>
      </form>
    </div>
  );
}
