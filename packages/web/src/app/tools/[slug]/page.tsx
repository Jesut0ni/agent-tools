import Link from "next/link";
import { notFound } from "next/navigation";
import { getTool, listVersions, listInvocations, API_BASE } from "@/lib/api";
import { getSession } from "@/lib/session";
import { MethodBadge, AuthChip } from "@/lib/badges";
import { TryIt } from "./try-it";
import { CodeSnippets } from "./code-snippets";
import { DeleteButton } from "./delete-button";

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = await getTool(slug);
  if (!tool) notFound();

  const spec = tool.spec;
  const versions = await listVersions(slug);
  const session = await getSession();
  const isOwner = !!session && tool.ownerId === session.developerId;
  const recent = isOwner && session ? await listInvocations(session.apiKey, { slug, limit: 10 }) : null;
  const exampleInput =
    spec?.examples && spec.examples.length > 0 ? spec.examples[0].input : undefined;

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xs font-mono text-zinc-500 hover:text-brand-500 transition">
          ← directory
        </Link>
        {isOwner && <DeleteButton slug={tool.slug} />}
      </div>

      <header className="space-y-4 animate-fade-up">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm text-zinc-500">{tool.slug}</span>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <span className="text-xs font-mono text-zinc-400">
            v{tool.latestVersion ?? "—"}
          </span>
          {isOwner && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-400">
              you own this
            </span>
          )}
        </div>
        <h1 className="text-4xl font-bold tracking-tight">{tool.name}</h1>
        {tool.description && (
          <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl text-lg">{tool.description}</p>
        )}
        {spec && (
          <div className="flex items-center gap-2 pt-1">
            <MethodBadge method={spec.endpoint.method} />
            <AuthChip type={spec.auth.type} />
          </div>
        )}
      </header>

      {spec && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 font-mono text-sm flex items-center gap-3 overflow-x-auto">
          <MethodBadge method={spec.endpoint.method} />
          <span className="text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
            {spec.endpoint.url}
          </span>
        </div>
      )}

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <SectionLabel>Spec</SectionLabel>
          {spec ? (
            <div className="space-y-3">
              <SchemaCard label="Input" data={spec.input} />
              <SchemaCard label="Output" data={spec.output} />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No spec available.</p>
          )}
        </div>

        <div className="space-y-3">
          <SectionLabel>Try it</SectionLabel>
          <TryIt slug={tool.slug} initialInput={exampleInput} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>Call it from your agent</SectionLabel>
        <CodeSnippets slug={tool.slug} apiBase={API_BASE} example={exampleInput} />
      </section>

      {recent && (
        <section className="space-y-3">
          <SectionLabel>Recent activity · owner only · {recent.count}</SectionLabel>
          {recent.items.length === 0 ? (
            <div className="border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-6 text-center text-sm text-zinc-500">
              No invocations yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              {recent.items.map((inv) => {
                const ok = inv.status > 0 && inv.status < 400;
                return (
                  <li key={inv.id} className="p-3 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`font-mono px-1.5 py-0.5 rounded border ${
                          ok
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                        }`}
                      >
                        {inv.status || "ERR"}
                      </span>
                      <span className="font-mono text-zinc-500 truncate">
                        {inv.callerKind === "developer"
                          ? `dev:${inv.callerId?.slice(0, 8) ?? "?"}…`
                          : inv.callerKind === "agent"
                            ? "agent (jwt)"
                            : "anonymous"}
                      </span>
                      {inv.errorMessage && (
                        <span className="text-red-500 truncate hidden md:inline">{inv.errorMessage}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-zinc-500">{inv.durationMs}ms</span>
                      <time className="font-mono text-zinc-400">
                        {new Date(inv.calledAt).toLocaleTimeString()}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-3">
        <SectionLabel>Versions · {versions.length}</SectionLabel>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          {versions.map((v) => (
            <li
              key={v.id}
              className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold">v{v.version}</span>
                {v.version === tool.latestVersion && (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    latest
                  </span>
                )}
              </div>
              <time className="text-xs font-mono text-zinc-500">
                {new Date(v.createdAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{children}</h2>
  );
}

function SchemaCard({ label, data }: { label: string; data: unknown }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <pre className="px-4 py-3 text-xs overflow-x-auto bg-white dark:bg-zinc-950/40">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
