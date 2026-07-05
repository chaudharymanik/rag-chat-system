import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Chat",
  description: "Upload a document and ask questions grounded only in what you've uploaded.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-border">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
              <div className="flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-accent"
                >
                  <path
                    d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061V18.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5v-13Z"
                    strokeLinejoin="round"
                  />
                  <path d="M8 9h8M8 12.5h8M8 16h5" strokeLinecap="round" />
                </svg>
                <span className="font-semibold tracking-tight">RAG Chat</span>
              </div>
              <a
                href="https://github.com/chaudharymanik/rag-chat-system"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                View source
              </a>
            </div>
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
