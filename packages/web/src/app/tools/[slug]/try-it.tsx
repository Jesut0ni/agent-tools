"use client";

import { useState } from "react";
import { readSessionFromCookie } from "@/lib/session-client";

export function TryIt({
  slug,
  initialInput,
}: {
  slug: string;
  initialInput?: unknown;
}) {
  const defaultText =
    initialInput !== undefined
      ? JSON.stringify(initialInput, null, 2)
      : '{\n  "message": "hello"\n}';

  const [input, setInput] = useState(defaultText);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    status: number;
    body: unknown;
    durationMs?: number;
  } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch {
        setResult({ ok: false, status: 0, body: { error: "Input is not valid JSON" } });
        return;
      }
      const apiBase =
        process.env.NEXT_PUBLIC_AGENT_TOOLS_API_URL ?? "http://localhost:3002";
      const session = readSessionFromCookie();
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (session) headers.Authorization = `Bearer ${session.apiKey}`;
      const started = Date.now();
      const res = await fetch(`${apiBase}/api/v1/tools/${slug}/call`, {
        method: "POST",
        headers,
        body: JSON.stringify(parsed),
      });
      const body = await res.json().catch(() => ({}));
      setResult({
        ok: res.ok,
        status: res.status,
        body,
        durationMs: Date.now() - started,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
          <span>Input JSON</span>
          <span className="text-zinc-400">editable</span>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={7}
          spellCheck={false}
          className="block w-full px-4 py-3 font-mono text-xs bg-white dark:bg-zinc-950/40 focus:outline-none resize-y"
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium shadow-sm shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy ? (
            <>
              <span className="inline-block w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Invoking
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M4 3.5c0-.4.45-.65.79-.42l8 5.5c.3.2.3.64 0 .84l-8 5.5A.5.5 0 0 1 4 14.5v-11Z" />
              </svg>
              Invoke
            </>
          )}
        </button>
        {result?.durationMs !== undefined && (
          <span className="text-xs font-mono text-zinc-500">{result.durationMs}ms</span>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex items-center gap-2">
            <span
              className={`text-[10px] font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded border ${
                result.ok
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
              }`}
            >
              {result.status || "ERR"}
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Response
            </span>
          </div>
          <pre className="px-4 py-3 text-xs overflow-x-auto bg-white dark:bg-zinc-950/40 max-h-80">
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
