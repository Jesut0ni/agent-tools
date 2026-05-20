import { redirect } from "next/navigation";
import Link from "next/link";
import { publishTool } from "@/lib/api";
import { getSession } from "@/lib/session";

const DEFAULT_INPUT_SCHEMA = `{
  "type": "object",
  "properties": {
    "message": { "type": "string" }
  },
  "required": ["message"]
}`;

const DEFAULT_OUTPUT_SCHEMA = `{
  "type": "object"
}`;

const DEFAULT_EXAMPLE = `{
  "message": "hello"
}`;

function parseJsonField(raw: string, field: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`${field} is not valid JSON: ${(err as Error).message}`);
  }
}

async function publishAction(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session) redirect("/signup");

  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  const method = String(formData.get("method") ?? "POST");
  const url = String(formData.get("url") ?? "").trim();
  const authType = String(formData.get("auth") ?? "none");

  let input: unknown;
  let output: unknown;
  let example: unknown;
  try {
    input = parseJsonField(String(formData.get("input") ?? ""), "Input schema") ?? {};
    output = parseJsonField(String(formData.get("output") ?? ""), "Output schema") ?? {};
    example = parseJsonField(String(formData.get("example") ?? ""), "Example input");
  } catch (err) {
    redirect(`/publish?error=${encodeURIComponent((err as Error).message)}`);
  }

  const payload: Record<string, unknown> = {
    slug,
    name,
    description,
    version,
    spec: {
      endpoint: { method, url },
      input,
      output,
      auth: { type: authType },
      ...(example !== undefined ? { examples: [{ input: example }] } : {}),
    },
  };

  const result = await publishTool(payload, session.apiKey);
  if (!result.ok) {
    const message =
      typeof result.body === "object" && result.body
        ? JSON.stringify(result.body, null, 2)
        : `HTTP ${result.status}`;
    redirect(`/publish?error=${encodeURIComponent(message)}`);
  }

  redirect(`/tools/${slug}`);
}

export default async function PublishPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const { error } = await searchParams;

  if (!session) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-10">
        <h1 className="text-2xl font-bold">Sign in to publish</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          You need an API key to publish a tool. Signing up takes one email.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium"
        >
          Get an API key →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <header className="space-y-3 animate-fade-up">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-zinc-500">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500" />
          new tool · publishing as {session.email}
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Publish a tool</h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-lg max-w-2xl">
          Register an agent-callable endpoint. The input and output schemas tell
          agents what to send and what they&apos;ll get back.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-200 p-4">
          <div className="text-xs font-mono uppercase tracking-widest mb-1">
            Publish failed
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
        </div>
      )}

      <form action={publishAction} className="space-y-8">
        <Section title="Identity" subtitle="How your tool shows up in the directory.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug" hint="lowercase, - or _ separators">
              <input name="slug" required placeholder="acme-send-invoice" className={inputCls} />
            </Field>
            <Field label="Initial version" hint="semver">
              <input name="version" required defaultValue="0.1.0" className={inputCls} />
            </Field>
          </div>
          <Field label="Name">
            <input name="name" required placeholder="Send invoice" className={inputCls} />
          </Field>
          <Field label="Description" optional>
            <textarea
              name="description"
              rows={2}
              placeholder="What this tool does, when an agent should call it."
              className={inputCls}
            />
          </Field>
        </Section>

        <Section title="Endpoint" subtitle="Where the call gets proxied.">
          <Field label="HTTP endpoint">
            <div className="flex gap-2">
              <select name="method" defaultValue="POST" className={`${inputCls} w-28 font-mono`}>
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>
              <input
                name="url"
                required
                placeholder="https://api.example.com/endpoint"
                className={`${inputCls} flex-1 font-mono text-xs`}
              />
            </div>
          </Field>
          <Field label="Auth">
            <select name="auth" className={inputCls} defaultValue="none">
              <option value="none">none — endpoint is open</option>
              <option value="bearer">bearer — caller&apos;s token is forwarded</option>
              <option value="agentgate">agentgate — validated by AgentGate JWT</option>
            </select>
          </Field>
        </Section>

        <Section
          title="Schemas"
          subtitle="JSON Schema for input and output. This is the machine-readable contract."
        >
          <Field label="Input schema">
            <textarea
              name="input"
              rows={8}
              defaultValue={DEFAULT_INPUT_SCHEMA}
              spellCheck={false}
              className={`${inputCls} font-mono text-xs`}
            />
          </Field>
          <Field label="Output schema">
            <textarea
              name="output"
              rows={6}
              defaultValue={DEFAULT_OUTPUT_SCHEMA}
              spellCheck={false}
              className={`${inputCls} font-mono text-xs`}
            />
          </Field>
          <Field label="Example input" hint="pre-fills Try it" optional>
            <textarea
              name="example"
              rows={5}
              defaultValue={DEFAULT_EXAMPLE}
              spellCheck={false}
              className={`${inputCls} font-mono text-xs`}
            />
          </Field>
        </Section>

        <div className="flex items-center justify-end gap-3 pt-2">
          <a href="/" className="px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Cancel
          </a>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium shadow-sm shadow-brand-500/20 transition"
          >
            Publish tool
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8h10m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-sm transition";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid md:grid-cols-[200px_1fr] gap-6">
      <div className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 leading-relaxed">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium flex items-center gap-2">
        {label}
        {optional && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">optional</span>
        )}
        {hint && <span className="text-xs text-zinc-500 font-normal">— {hint}</span>}
      </span>
      {children}
    </label>
  );
}
