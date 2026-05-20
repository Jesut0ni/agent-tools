"use client";

import type { DevSession } from "./session";

export const SESSION_COOKIE = "at_session";

export function readSessionFromCookie(): DevSession | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  try {
    const json = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json) as DevSession;
    if (
      typeof parsed.apiKey !== "string" ||
      typeof parsed.developerId !== "string" ||
      typeof parsed.email !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}
