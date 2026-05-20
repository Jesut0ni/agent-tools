"use client";

import { useState } from "react";

export function CodeSnippets({
  slug,
  apiBase,
  example,
}: {
  slug: string;
  apiBase: string;
  example?: unknown;
}) {
  const [tab, setTab] = useState<"curl" | "ts" | "py">("curl");
  const [copied, setCopied] = useState(false);

  const inputJson = example !== undefined ? JSON.stringify(example) : '{"message":"hello"}';
  const inputJsonPretty =
    example !== undefined ? JSON.stringify(example, null, 2) : '{\n  "message": "hello"\n}';

  const curl = `curl -X POST ${apiBase}/api/v1/tools/${slug}/call \\
  -H 'Content-Type: application/json' \\
  -d '${inputJson}'`;

  const ts = `const res = await fetch(
  "${apiBase}/api/v1/tools/${slug}/call",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(${inputJsonPretty.split("\n").join("\n      ")}),
  }
);
const { status, body, durationMs } = await res.json();`;

  const py = `import requests

res = requests.post(
    "${apiBase}/api/v1/tools/${slug}/call",
    json=${inputJsonPretty.split("\n").join("\n    ")},
)
data = res.json()
print(data["status"], data["body"])`;

  const active = tab === "curl" ? curl : tab === "ts" ? ts : py;

  async function copy() {
    await navigator.clipboard.writeText(active);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950/40">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 px-3 py-2">
        <div className="flex gap-1">
          <TabBtn active={tab === "curl"} onClick={() => setTab("curl")}>
            curl
          </TabBtn>
          <TabBtn active={tab === "ts"} onClick={() => setTab("ts")}>
            TypeScript
          </TabBtn>
          <TabBtn active={tab === "py"} onClick={() => setTab("py")}>
            Python
          </TabBtn>
        </div>
        <button
          type="button"
          onClick={copy}
          className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 hover:text-brand-500 transition flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m3 8 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              copied
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="5" width="9" height="9" rx="1.5" />
                <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
              </svg>
              copy
            </>
          )}
        </button>
      </div>
      <pre className="px-4 py-4 text-xs overflow-x-auto leading-relaxed">{active}</pre>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-mono transition ${
        active
          ? "bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-sm"
          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
