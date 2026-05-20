import Link from "next/link";
import { listTools } from "@/lib/api";
import { MethodBadge, AuthChip } from "@/lib/badges";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { items, count } = await listTools(q);

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative isolate -mx-6 px-6 pt-10 pb-14 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-hero-glow"
        />
        <div className="max-w-3xl mx-auto text-center space-y-6 animate-fade-up">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-zinc-500">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            an open registry for ai agents
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
            Tools your{" "}
            <span className="bg-gradient-to-r from-brand-500 to-brand-300 bg-clip-text text-transparent">
              agents
            </span>{" "}
            can actually call.
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-lg max-w-xl mx-auto">
            Publish a typed, versioned tool once. Agents discover it, call it,
            and get a deterministic response — no human, no clicking.
          </p>
          <form action="/" method="get" className="max-w-xl mx-auto pt-2">
            <div className="relative">
              <svg
                viewBox="0 0 16 16"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <circle cx="7" cy="7" r="5" />
                <path d="m14 14-3-3" strokeLinecap="round" />
              </svg>
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search tools by name, slug, or description"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur shadow-sm focus:shadow-glow focus:border-brand-500 focus:outline-none transition"
              />
            </div>
          </form>
        </div>
      </section>

      {/* Directory */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
            {q ? `Results for "${q}"` : "Directory"}
          </h2>
          <span className="text-xs font-mono text-zinc-500">
            {count} {count === 1 ? "tool" : "tools"}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-zinc-500 mb-3">
              {q ? "No tools match your search." : "No tools yet."}
            </p>
            <Link
              href="/publish"
              className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-500"
            >
              Publish the first one →
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((tool, i) => (
              <li
                key={tool.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className="animate-fade-up"
              >
                <Link
                  href={`/tools/${tool.slug}`}
                  className="group block h-full p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 hover:bg-white dark:hover:bg-zinc-900 hover:border-brand-500/50 hover:shadow-glow transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {tool.spec?.endpoint?.method && (
                        <MethodBadge method={tool.spec.endpoint.method} />
                      )}
                      <span className="font-mono text-xs text-zinc-500 truncate">
                        {tool.slug}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                      v{tool.latestVersion ?? "—"}
                    </span>
                  </div>
                  <div className="font-semibold tracking-tight mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                    {tool.name}
                  </div>
                  {tool.description && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {tool.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                    {tool.spec?.auth?.type ? (
                      <AuthChip type={tool.spec.auth.type} />
                    ) : (
                      <span />
                    )}
                    <span className="text-xs font-mono text-zinc-400 group-hover:text-brand-500 transition">
                      try it →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
