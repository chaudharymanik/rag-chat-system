"use client";

import { useEffect, useRef, useState } from "react";
import { readStreamableValue } from "ai/rsc";
import { askQuestion } from "@/app/actions/chat";
import { clearConversation } from "@/app/actions/history";
import { uploadDocument } from "@/app/actions/upload";
import type { ChatMessage } from "@/lib/types";

function newId(): string {
  return crypto.randomUUID();
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 15V4M12 4 8 8M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M6 3.5A1.5 1.5 0 0 1 7.5 2h5.379a1.5 1.5 0 0 1 1.06.44l3.122 3.12a1.5 1.5 0 0 1 .439 1.061V20.5A1.5 1.5 0 0 1 16 22H7.5A1.5 1.5 0 0 1 6 20.5v-17Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

type UploadStatus = { kind: "idle" | "uploading" | "error"; message?: string };

export function ChatPanel() {
  // Deliberately not persisted anywhere (no localStorage, no auto-restore):
  // every page load is a brand new, empty session. A public demo link should
  // never resurface a previous visitor's document or conversation.
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId(newId());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function processUpload(file: File) {
    if (!sessionId) return;

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
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUpload(file);
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

  const hasDocument = uploadedFiles.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      {!hasDocument ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Chat with a document</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Upload a file and ask questions about it. Answers are grounded only in what you
              upload — nothing else, and nothing carries over between visits.
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex w-full max-w-sm cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed px-8 py-10 transition-colors ${
              isDragging ? "border-accent bg-surface-2" : "border-border bg-surface hover:border-muted"
            }`}
          >
            <div className="text-accent">
              <UploadIcon />
            </div>
            <div>
              <p className="text-sm font-medium">Drop a file, or click to browse</p>
              <p className="mt-1 text-xs text-muted">.txt, .md, or .pdf</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf"
              onChange={handleFileInput}
              className="hidden"
              suppressHydrationWarning
            />
          </div>

          {uploadStatus.kind === "uploading" && (
            <p className="text-sm text-muted">Indexing document…</p>
          )}
          {uploadStatus.kind === "error" && (
            <p className="text-sm text-red-400">{uploadStatus.message}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
            {uploadedFiles.map((name) => (
              <span
                key={name}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted"
              >
                <FileIcon />
                {name}
              </span>
            ))}
            <label className="ml-auto cursor-pointer text-xs text-muted transition-colors hover:text-foreground">
              + Add another
              <input
                type="file"
                accept=".txt,.md,.pdf"
                onChange={handleFileInput}
                disabled={uploadStatus.kind === "uploading"}
                className="hidden"
                suppressHydrationWarning
              />
            </label>
            {uploadStatus.kind === "uploading" && <span className="text-xs text-muted">Indexing…</span>}
            {uploadStatus.kind === "error" && (
              <span className="text-xs text-red-400">{uploadStatus.message}</span>
            )}
          </div>

          <div className="flex min-h-[55vh] flex-1 flex-col gap-4 overflow-y-auto py-2">
            {messages.length === 0 && (
              <p className="m-auto max-w-xs text-center text-sm text-muted">
                Ask a question about {uploadedFiles.length === 1 ? "the document" : "these documents"}{" "}
                above.
              </p>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-accent-foreground"
                    : message.role === "error"
                      ? "mr-auto max-w-[80%] rounded-2xl rounded-bl-sm border border-red-900/50 bg-red-950/40 px-4 py-2.5 text-sm text-red-300"
                      : "mr-auto max-w-[80%] rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2.5 text-sm"
                }
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.content || "…"}</p>

                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 border-t border-border/60 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                      className="text-muted transition-colors hover:text-foreground"
                    >
                      {expanded[message.id] ? "Hide" : "Show"} {message.sources.length} source
                      {message.sources.length > 1 ? "s" : ""}
                    </button>
                    {expanded[message.id] && (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {message.sources.map((source) => (
                          <li key={source.id} className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-muted">
                            <div className="flex justify-between font-mono text-[10px] text-muted/70">
                              <span>{(source.metadata?.source as string) ?? source.id}</span>
                              <span>score {source.score.toFixed(2)}</span>
                            </div>
                            <p className="mt-0.5 line-clamp-2">{source.content}</p>
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

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border pt-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={busy}
              className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity disabled:opacity-40"
            >
              <SendIcon />
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={busy}
              aria-label="Clear session"
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:text-foreground disabled:opacity-40"
            >
              <XIcon />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
