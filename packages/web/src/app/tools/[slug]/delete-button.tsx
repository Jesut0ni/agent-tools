import { redirect } from "next/navigation";
import { deleteTool } from "@/lib/api";
import { getSession } from "@/lib/session";

async function deleteAction(formData: FormData) {
  "use server";
  const session = await getSession();
  if (!session) redirect("/signup");
  const slug = String(formData.get("slug") ?? "");
  const result = await deleteTool(slug, session.apiKey);
  if (!result.ok) {
    redirect(`/tools/${slug}?error=${encodeURIComponent(`Delete failed: HTTP ${result.status}`)}`);
  }
  redirect("/");
}

export function DeleteButton({ slug }: { slug: string }) {
  return (
    <form action={deleteAction} className="inline">
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300 text-xs font-medium hover:bg-red-500/10 transition"
      >
        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 5h10M6 5V3.5A.5.5 0 0 1 6.5 3h3a.5.5 0 0 1 .5.5V5M4 5l.5 8a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1L12 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Delete tool
      </button>
    </form>
  );
}
