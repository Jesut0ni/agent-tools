import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db } from "../db/client.js";
import { developers } from "../db/schema/developers.js";
import { generateApiKey } from "../lib/api-keys.js";
import { authMiddleware, requireDeveloper, type Caller } from "../middleware/auth.js";
import { getEnv } from "../env.js";
import { logger } from "../lib/logger.js";

const signupSchema = z.object({
  email: z.string().email().toLowerCase().max(254),
});

const verifySchema = z.object({
  token: z.string().min(16).max(128),
});

type Vars = { Variables: { caller: Caller } };
const app = new Hono<Vars>();
app.use("*", authMiddleware);

function newToken() {
  return randomBytes(24).toString("base64url");
}

// POST /developers — start signup. No API key yet; verify first.
app.post("/", async (c) => {
  const env = getEnv();
  const body = signupSchema.parse(await c.req.json());

  const existing = await db.query.developers.findFirst({
    where: eq(developers.email, body.email),
  });

  let token: string;
  if (existing) {
    // Re-issue a verification token if not yet verified (lets users retry signup).
    if (existing.verified) {
      throw new HTTPException(409, {
        message: "A verified developer with this email already exists",
      });
    }
    token = newToken();
    await db
      .update(developers)
      .set({ verificationToken: token })
      .where(eq(developers.id, existing.id));
  } else {
    token = newToken();
    await db.insert(developers).values({
      email: body.email,
      verificationToken: token,
      verified: false,
    });
  }

  const verifyUrl = `${env.PUBLIC_API_URL.replace(/\/$/, "")}/api/v1/developers/verify?token=${token}`;
  logger.info({ email: body.email, verifyUrl }, "Signup initiated — share this verify URL with the user");

  const exposeUrl = env.NODE_ENV !== "production";
  return c.json(
    {
      email: body.email,
      verificationRequired: true,
      ...(exposeUrl ? { verifyUrl, token } : {}),
      message: exposeUrl
        ? "Use the verifyUrl to confirm your email and receive your API key."
        : "Check your email for a verification link.",
    },
    202
  );
});

async function consumeToken(token: string) {
  const dev = await db.query.developers.findFirst({
    where: eq(developers.verificationToken, token),
  });
  if (!dev) throw new HTTPException(404, { message: "Invalid or expired verification token" });
  if (dev.verified) throw new HTTPException(409, { message: "Already verified" });

  const { full, hash, preview } = generateApiKey();
  await db
    .update(developers)
    .set({
      verified: true,
      verificationToken: null,
      apiKeyHash: hash,
      apiKeyPreview: preview,
    })
    .where(eq(developers.id, dev.id));

  return {
    id: dev.id,
    email: dev.email,
    apiKey: full,
    apiKeyPreview: preview,
    createdAt: dev.createdAt.toISOString(),
    warning: "Save this apiKey now — it will not be shown again.",
  };
}

// POST /developers/verify — confirm and mint the API key
app.post("/verify", async (c) => {
  const body = verifySchema.parse(await c.req.json());
  const result = await consumeToken(body.token);
  return c.json(result, 201);
});

// GET /developers/verify?token=... — convenience for email links
app.get("/verify", async (c) => {
  const parsed = verifySchema.safeParse(c.req.query());
  if (!parsed.success) {
    throw new HTTPException(400, { message: "token query parameter is required" });
  }
  const result = await consumeToken(parsed.data.token);
  return c.json(result, 201);
});

// GET /developers/me — current developer
app.get("/me", async (c) => {
  const caller = c.get("caller");
  requireDeveloper(caller);
  return c.json({
    id: caller.developer.id,
    email: caller.developer.email,
    apiKeyPreview: caller.developer.apiKeyPreview,
    suspended: caller.developer.suspended,
    createdAt: caller.developer.createdAt.toISOString(),
  });
});

export default app;
