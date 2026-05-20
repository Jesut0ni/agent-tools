import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signupDeveloper } from "@/lib/api";
import { SESSION_COOKIE, encodeSession } from "@/lib/session";

async function signupAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/signup?error=Email+is+required");

  const result = await signupDeveloper(email);
  if (!result.ok) {
    const body = result.body as Record<string, unknown>;
    const message =
      body && typeof body === "object" && "error" in body
        ? JSON.stringify((body as { error: unknown }).error)
        : `HTTP ${result.status}`;
    redirect(`/signup?error=${encodeURIComponent(message)}`);
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession({
    apiKey: result.body.apiKey,
    developerId: result.body.id,
    email: result.body.email,
    apiKeyPreview: result.body.apiKeyPreview,
  }), {
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
    sameSite: "lax",
  });

  redirect(`/signup?welcome=${encodeURIComponent(result.body.apiKey)}`);
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; welcome?: string }>;
}) {
  const { error, welcome } = await searchParams;

  return (
    <div className="max-w-md mx-auto space-y-8">
      <header className="space-y-3 animate-fade-up">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-zinc-500">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500" />
          developer signup
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Get an API key</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          One email, one API key. Use it to publish tools, manage versions, and
          delete tools you own.
        </p>
      </header>

      {welcome ? (
        <div className="space-y-4 rounded-xl border border-brand-500/30 bg-brand-500/5 p-5">
          <div className="text-xs font-mono uppercase tracking-widest text-brand-600 dark:text-brand-400">
            Save this key now
          </div>
          <pre className="font-mono text-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-950/40 border border-brand-500/30 overflow-x-auto select-all">
            {welcome}
          </pre>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            We&apos;ve set a session cookie so you can publish from this browser
            right away. But this is the only time the full key is shown.
          </p>
          <div className="flex items-center gap-3 pt-2">
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
      ) : (
        <>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-200 p-4">
              <div className="text-xs font-mono uppercase tracking-widest mb-1">Signup failed</div>
              <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
            </div>
          )}
          <form action={signupAction} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm"
              />
            </label>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium shadow-sm shadow-brand-500/20 transition"
            >
              Generate API key
            </button>
          </form>
        </>
      )}
    </div>
  );
}
