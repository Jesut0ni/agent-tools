import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "agent-tools — registry for AI agents",
  description:
    "Open registry of machine-readable tools designed for AI agents to discover and call programmatically.",
};

async function signoutAction() {
  "use server";
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en">
      <body>
        <header className="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold tracking-tight"
            >
              <LogoMark />
              <span>agent-tools</span>
              <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                v0
              </span>
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              >
                Directory
              </Link>
              <Link
                href="/import"
                className="hidden md:inline px-3 py-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              >
                Import
              </Link>
              <Link
                href="https://github.com/Jesut0ni/agentgate"
                target="_blank"
                className="hidden md:inline px-3 py-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              >
                AgentGate
              </Link>
              {session ? (
                <SessionPill email={session.email} preview={session.apiKeyPreview} action={signoutAction} />
              ) : (
                <Link
                  href="/signup"
                  className="px-3 py-1.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
                >
                  Sign up
                </Link>
              )}
              <Link
                href="/publish"
                className="px-3 py-1.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition font-medium"
              >
                Publish
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-12">{children}</main>
        <footer className="max-w-6xl mx-auto px-6 py-10 mt-12 border-t border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              <span className="font-mono">v0 · local</span>
            </div>
            <div className="flex items-center gap-4">
              <a className="hover:text-zinc-900 dark:hover:text-zinc-100" href="https://github.com/Jesut0ni/agentgate">
                AgentGate
              </a>
              <span className="text-zinc-400 dark:text-zinc-700">·</span>
              <a className="hover:text-zinc-900 dark:hover:text-zinc-100" href="https://www.ycombinator.com/rfs">
                YC RFS S26
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function SessionPill({
  email,
  preview,
  action,
}: {
  email: string;
  preview: string;
  action: () => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs">
      <span className="inline-flex w-5 h-5 rounded-full bg-brand-500/15 items-center justify-center text-brand-700 dark:text-brand-300 text-[10px] font-semibold">
        {email[0]?.toUpperCase() ?? "?"}
      </span>
      <span className="hidden md:inline truncate max-w-[160px] text-zinc-700 dark:text-zinc-300">
        {email}
      </span>
      <span className="hidden md:inline font-mono text-[10px] text-zinc-400">{preview}</span>
      <form action={action} className="inline">
        <button
          type="submit"
          className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition"
        >
          out
        </button>
      </form>
    </div>
  );
}

function LogoMark() {
  return (
    <span className="relative inline-flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm">
      <svg
        viewBox="0 0 16 16"
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 4 L8 1 L14 4 L14 12 L8 15 L2 12 Z" />
        <path d="M8 1 L8 8" />
        <path d="M2 4 L8 8 L14 4" />
      </svg>
    </span>
  );
}
