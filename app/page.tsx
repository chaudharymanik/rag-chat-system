import { ChatPanel } from "@/components/chat-panel";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-xl font-semibold">RAG Chat System</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Upload a document and ask questions about it. Answers are grounded only in what
          you&apos;ve uploaded in this session — ask something outside that scope and it
          should tell you it doesn&apos;t know.
        </p>
      </header>
      <ChatPanel />
    </main>
  );
}
