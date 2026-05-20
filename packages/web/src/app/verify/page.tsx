import { cookies } from "next/headers";
import Link from "next/link";
import { verifyDeveloper } from "@/lib/api";
import { SESSION_COOKIE, encodeSession } from "@/lib/session";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <ErrorView title="Missing token" detail="No verification token was provided in the URL." />
    );
  }

  const result = await verifyDeveloper(token);
  if (!result.ok) {
    const body = result.body as Record<string, unknown>;
    const detail =
      body && typeof body === "object" && "error" in body
        ? JSON.stringify((body as { error: unknown }).error, null, 2)
        : `HTTP ${result.status}`;
    return <ErrorView title="Verification failed" detail={detail} />;
  }

  const { id, email, apiKey, apiKeyPreview } = result.body;

  const jar = await cookies();
  jar.set(
    SESSION_COOKIE,
    encodeSession({ apiKey, developerId: id, email, apiKeyPreview }),
    { path: "/", maxAge: 60 * 60 * 24 * 90, sameSite: "lax" }
  );

  return (
    <div className="max-w-md mx-auto space-y-8">
      <header className="space-y-3 animate-fade-up">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-brand-600 dark:text-brand-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500" />
          email verified
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Welcome aboard</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Signed in as <span className="font-mono">{email}</span>. Save this
          key — it&apos;s the only time we&apos;ll show the full string.
        </p>
      </header>

      <div className="space-y-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-5">
        <div className="text-xs font-mono uppercase tracking-widest text-brand-600 dark:text-brand-400">
          Your API key
        </div>
        <pre className="font-mono text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950/40 border border-brand-500/30 overflow-x-auto select-all">
          {apiKey}
        </pre>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          We&apos;ve set a session cookie so you can publish from this browser
          right away. Store the key in a password manager — if you lose it
          you&apos;ll need to request a new one (rotation coming soon).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/publish"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium"
        >
          Publish your first tool →
        </Link>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          or browse the directory
        </Link>
      </div>
    </div>
  );
}

function ErrorView({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <header className="space-y-2 animate-fade-up">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-red-600 dark:text-red-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
          verification
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </header>
      <pre className="rounded-xl border border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-200 p-4 whitespace-pre-wrap font-mono text-xs">
        {detail}
      </pre>
      <Link href="/signup" className="text-sm text-brand-600 hover:text-brand-500">
        try signing up again →
      </Link>
    </div>
  );
}
