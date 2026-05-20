"use client";

import { useState } from "react";
import Link from "next/link";
import { parseOpenApi, type ToolCandidate } from "@/lib/openapi";
import { readSessionFromCookie } from "@/lib/session-client";
import { API_BASE } from "@/lib/api";

interface PublishResult {
  slug: string;
  ok: boolean;
  status: number;
  message?: string;
}

export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [specText, setSpecText] = useState("");
  const [candidates, setCandidates] = useState<ToolCandidate[] | null>(null);
  const [info, setInfo] = useState<{ title: string; version: string } | null>(null);
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PublishResult[] | null>(null);

  async function loadFromUrl() {
    if (!url) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setError(`Failed to fetch spec: HTTP ${res.status}`);
        return;
      }
      const text = await res.text();
      setSpecText(text);
      preview(text);
    } catch (err) {
      setError(`Network error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function preview(textOverride?: string) {
    setError(null);
    setResults(null);
    const source = textOverride ?? specText;
    if (!source.trim()) {
      setError("Paste an OpenAPI spec or load one from a URL first.");
      return;
    }
    try {
      const parsed = parseOpenApi(source);
      setInfo(parsed.info);
      setCandidates(parsed.candidates);
      setPicks(new Set(parsed.candidates.map((c) => c.slug)));
    } catch (err) {
      setCandidates(null);
      setError((err as Error).message);
    }
  }

  function toggle(slug: string) {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function publish() {
    const session = readSessionFromCookie();
    if (!session) {
      window.location.href = "/signup";
      return;
    }
    if (!candidates) return;
    setBusy(true);
    setResults(null);
    const out: PublishResult[] = [];
    for (const c of candidates) {
      if (!picks.has(c.slug)) continue;
      const payload = {
        slug: c.slug,
        name: c.name,
        description: c.description,
        version: "0.1.0",
        spec: {
          endpoint: { method: c.method, url: c.url },
          input: c.input,
          output: c.output,
          auth: { type: c.auth },
        },
      };
      try {
        const res = await fetch(`${API_BASE}/api/v1/tools`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.apiKey}`,
          },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        out.push({
          slug: c.slug,
          ok: res.ok,
          status: res.status,
          message: res.ok
            ? undefined
            : typeof body === "object" && body && "error" in body
              ? JSON.stringify((body as { error: unknown }).error)
              : `HTTP ${res.status}`,
        });
      } catch (err) {
        out.push({ slug: c.slug, ok: false, status: 0, message: (err as Error).message });
      }
    }
    setResults(out);
    setBusy(false);
  }

  const successCount = results?.filter((r) => r.ok).length ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header className="space-y-3 animate-fade-up">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-zinc-500">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500" />
          openapi importer
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Import from OpenAPI</h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-lg max-w-2xl">
          Paste an OpenAPI 3 spec URL or JSON. We&apos;ll convert every operation
          into a tool candidate — pick the ones you want, publish in bulk.
        </p>
      </header>

      <section className="space-y-3">
        <div className="grid md:grid-cols-[1fr_auto] gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
            className={inputCls}
          />
          <button
            type="button"
            onClick={loadFromUrl}
            disabled={busy || !url}
            className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-50"
          >
            Load from URL
          </button>
        </div>
        <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
          <summary className="px-4 py-2 text-xs font-mono uppercase tracking-wider text-zinc-500 cursor-pointer">
            ...or paste spec JSON
          </summary>
          <textarea
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder='{ "openapi": "3.0.0", "info": {...}, "paths": {...} }'
            className="block w-full px-4 py-3 font-mono text-xs bg-white dark:bg-zinc-950/40 focus:outline-none resize-y border-t border-zinc-200 dark:border-zinc-800"
          />
          <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => preview()}
              className="text-xs font-mono uppercase tracking-wider text-brand-600 hover:text-brand-500"
            >
              parse →
            </button>
          </div>
        </details>
      </section>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-200 p-4">
          <div className="text-xs font-mono uppercase tracking-widest mb-1">Parse failed</div>
          <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
        </div>
      )}

      {candidates && info && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-semibold">{info.title}</h2>
              <div className="text-xs font-mono text-zinc-500">
                v{info.version} · {candidates.length} operations · {picks.size} selected
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPicks(new Set(candidates.map((c) => c.slug)))}
                className="text-xs text-zinc-500 hover:text-brand-500"
              >
                select all
              </button>
              <span className="text-zinc-300">·</span>
              <button
                type="button"
                onClick={() => setPicks(new Set())}
                className="text-xs text-zinc-500 hover:text-brand-500"
              >
                clear
              </button>
            </div>
          </div>

          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            {candidates.map((c) => {
              const selected = picks.has(c.slug);
              return (
                <li
                  key={c.slug}
                  className={`p-4 transition ${selected ? "bg-brand-500/5" : "bg-white dark:bg-zinc-900/30"}`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggle(c.slug)}
                      className="mt-1 accent-brand-500"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded border bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-500/30">
                          {c.method}
                        </span>
                        <span className="font-mono text-xs text-zinc-500 truncate">{c.slug}</span>
                      </div>
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="font-mono text-xs text-zinc-500 truncate">{c.url}</div>
                      {c.description && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {c.description}
                        </p>
                      )}
                      {c.warnings.length > 0 && (
                        <ul className="text-[11px] text-amber-600 dark:text-amber-400">
                          {c.warnings.map((w, i) => (
                            <li key={i}>⚠ {w}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={publish}
              disabled={busy || picks.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium shadow-sm shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy ? "Publishing..." : `Publish ${picks.size} ${picks.size === 1 ? "tool" : "tools"}`}
            </button>
          </div>
        </section>
      )}

      {results && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Results · {successCount}/{results.length} published
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            {results.map((r) => (
              <li key={r.slug} className="p-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      r.ok
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                    }`}
                  >
                    {r.status || "ERR"}
                  </span>
                  {r.ok ? (
                    <Link href={`/tools/${r.slug}`} className="font-mono text-xs hover:text-brand-500 truncate">
                      {r.slug}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-zinc-500 truncate">{r.slug}</span>
                  )}
                </div>
                {r.message && (
                  <span className="text-xs text-zinc-500 truncate ml-3">{r.message}</span>
                )}
              </li>
            ))}
          </ul>
          {successCount > 0 && (
            <div className="text-right">
              <Link href="/" className="text-sm text-brand-600 hover:text-brand-500">
                browse the directory →
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm font-mono";
