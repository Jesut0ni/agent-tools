import { redirect } from "next/navigation";
import Link from "next/link";
import { signupDeveloper } from "@/lib/api";

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

  // Dev/test: API returns the token directly so we can route through our
  // own /verify page. Production: token goes via email (out of band).
  const token = result.body.token;
  if (token) {
    redirect(`/signup?pending=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`);
  }
  redirect(`/signup?sent=${encodeURIComponent(email)}`);
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; pending?: string; sent?: string }>;
}) {
  const { error, pending, sent } = await searchParams;

  return (
    <div className="max-w-md mx-auto space-y-8">
      <header className="space-y-3 animate-fade-up">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-zinc-500">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500" />
          developer signup
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Get an API key</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          One email, one verification step, one API key. Use it to publish
          tools, manage versions, and delete tools you own.
        </p>
      </header>

      {pending ? (
        <div className="space-y-4 rounded-xl border border-brand-500/30 bg-brand-500/5 p-5">
          <div className="text-xs font-mono uppercase tracking-widest text-brand-600 dark:text-brand-400">
            Verify to continue
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            In a real deployment we&apos;d email this link. Locally we surface
            it right here — click to confirm and receive your API key.
          </p>
          <Link
            href={`/verify?token=${encodeURIComponent(pending)}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium"
          >
            Confirm email →
          </Link>
        </div>
      ) : sent ? (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-5 space-y-2">
          <div className="text-xs font-mono uppercase tracking-widest text-brand-600 dark:text-brand-400">
            Check your email
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            We sent a verification link to <span className="font-mono">{sent}</span>.
            Click it to confirm and receive your API key.
          </p>
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
              Send verification link
            </button>
          </form>
        </>
      )}
    </div>
  );
}
