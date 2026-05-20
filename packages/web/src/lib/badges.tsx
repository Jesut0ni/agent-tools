import { cn } from "./cn";

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  POST: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  PUT: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  PATCH: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
  DELETE: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
};

export function MethodBadge({ method, className }: { method: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded border",
        METHOD_STYLES[method] ?? "bg-zinc-500/10 text-zinc-500 border-zinc-500/30",
        className
      )}
    >
      {method}
    </span>
  );
}

const AUTH_STYLES: Record<string, string> = {
  none: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  bearer: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  agentgate: "bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-500/30",
};

export function AuthChip({ type, className }: { type: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border",
        AUTH_STYLES[type] ?? AUTH_STYLES.none,
        className
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className="w-2.5 h-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <rect x="3" y="7" width="10" height="7" rx="1" />
        <path d="M5 7V5a3 3 0 0 1 6 0v2" />
      </svg>
      {type}
    </span>
  );
}
