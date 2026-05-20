import type { ToolSpec } from "@agent-tools/shared";

export const API_BASE = process.env.AGENT_TOOLS_API_URL ?? "http://localhost:3002";

export interface ToolRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  ownerId: string | null;
  visibility: "public" | "private";
  latestVersion: string | null;
  createdAt: string;
  updatedAt: string;
  spec: ToolSpec | null;
}

export interface ListToolsResponse {
  items: ToolRecord[];
  count: number;
  nextCursor: string | null;
}

function authHeaders(apiKey?: string): HeadersInit {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export async function listTools(query?: string): Promise<ListToolsResponse> {
  const url = new URL("/api/v1/tools", API_BASE);
  if (query) url.searchParams.set("q", query);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list tools: ${res.status}`);
  return res.json();
}

export async function getTool(slug: string): Promise<ToolRecord | null> {
  const res = await fetch(new URL(`/api/v1/tools/${slug}`, API_BASE), {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load tool: ${res.status}`);
  return res.json();
}

export interface ToolVersionRecord {
  id: string;
  version: string;
  spec: ToolSpec;
  createdAt: string;
}

export async function listVersions(slug: string): Promise<ToolVersionRecord[]> {
  const res = await fetch(new URL(`/api/v1/tools/${slug}/versions`, API_BASE), {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: ToolVersionRecord[] };
  return data.items;
}

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  body: T;
}

export async function publishTool(
  payload: unknown,
  apiKey: string
): Promise<ApiResult> {
  const res = await fetch(new URL("/api/v1/tools", API_BASE), {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders(apiKey) },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function deleteTool(slug: string, apiKey: string): Promise<ApiResult> {
  const res = await fetch(new URL(`/api/v1/tools/${slug}`, API_BASE), {
    method: "DELETE",
    headers: authHeaders(apiKey),
  });
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function signupDeveloper(
  email: string
): Promise<ApiResult<{ email: string; verificationRequired: boolean; verifyUrl?: string; token?: string; message?: string }>> {
  const res = await fetch(new URL("/api/v1/developers", API_BASE), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function verifyDeveloper(
  token: string
): Promise<ApiResult<{ id: string; email: string; apiKey: string; apiKeyPreview: string }>> {
  const res = await fetch(new URL("/api/v1/developers/verify", API_BASE), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export interface InvocationRecord {
  id: string;
  toolSlug: string;
  callerKind: "developer" | "agent" | "anonymous";
  callerId: string | null;
  status: number;
  durationMs: number;
  errorMessage: string | null;
  calledAt: string;
}

export async function listInvocations(
  apiKey: string,
  opts: { slug?: string; limit?: number } = {}
): Promise<{ items: InvocationRecord[]; count: number; nextCursor: string | null }> {
  const url = new URL("/api/v1/invocations", API_BASE);
  if (opts.slug) url.searchParams.set("slug", opts.slug);
  if (opts.limit) url.searchParams.set("limit", String(opts.limit));
  const res = await fetch(url, { headers: authHeaders(apiKey), cache: "no-store" });
  if (!res.ok) return { items: [], count: 0, nextCursor: null };
  return res.json();
}

export async function getCurrentDeveloper(apiKey: string): Promise<ApiResult> {
  const res = await fetch(new URL("/api/v1/developers/me", API_BASE), {
    headers: authHeaders(apiKey),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function invokeTool(
  slug: string,
  input: unknown,
  apiKey?: string
): Promise<ApiResult> {
  const res = await fetch(new URL(`/api/v1/tools/${slug}/call`, API_BASE), {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders(apiKey) },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
