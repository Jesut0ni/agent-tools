import { cookies } from "next/headers";

export const SESSION_COOKIE = "at_session";

export interface DevSession {
  apiKey: string;
  developerId: string;
  email: string;
  apiKeyPreview: string;
}

export async function getSession(): Promise<DevSession | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as DevSession;
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

export function encodeSession(session: DevSession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}
