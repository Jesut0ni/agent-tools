import { jwtVerify, type JWTPayload } from "jose";
import { HTTPException } from "hono/http-exception";
import { getEnv } from "../env.js";

function extractScopes(claims: JWTPayload): Set<string> {
  const scope = (claims as Record<string, unknown>).scope;
  if (typeof scope === "string") {
    return new Set(scope.split(/\s+/).filter(Boolean));
  }
  if (Array.isArray(scope)) {
    return new Set(scope.filter((s): s is string => typeof s === "string"));
  }
  const scopes = (claims as Record<string, unknown>).scopes;
  if (Array.isArray(scopes)) {
    return new Set(scopes.filter((s): s is string => typeof s === "string"));
  }
  return new Set();
}

/**
 * Verify an AgentGate-issued bearer token. AgentGate signs HS256 JWTs with a
 * shared secret in v0; once they expose JWKS, swap this for `createRemoteJWKSet`.
 */
export async function verifyAgentGateToken(
  token: string,
  requiredScopes: string[]
): Promise<JWTPayload> {
  const env = getEnv();
  const secret = new TextEncoder().encode(env.AGENTGATE_JWT_SECRET);

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, secret, {
      issuer: env.AGENTGATE_JWT_ISSUER,
    });
    payload = result.payload;
  } catch (err) {
    throw new HTTPException(401, {
      message: `AgentGate token invalid: ${(err as Error).message}`,
    });
  }

  if (requiredScopes.length > 0) {
    const owned = extractScopes(payload);
    const missing = requiredScopes.filter((s) => !owned.has(s));
    if (missing.length > 0) {
      throw new HTTPException(403, {
        message: `Missing required scopes: ${missing.join(", ")}`,
      });
    }
  }

  return payload;
}
