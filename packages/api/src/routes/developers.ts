import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { developers } from "../db/schema/developers.js";
import { generateApiKey } from "../lib/api-keys.js";
import { authMiddleware, requireDeveloper, type Caller } from "../middleware/auth.js";

const signupSchema = z.object({
  email: z.string().email().toLowerCase().max(254),
});

type Vars = { Variables: { caller: Caller } };
const app = new Hono<Vars>();
app.use("*", authMiddleware);

// POST /developers — create developer, return API key ONCE
app.post("/", async (c) => {
  const body = signupSchema.parse(await c.req.json());

  const existing = await db.query.developers.findFirst({
    where: eq(developers.email, body.email),
  });
  if (existing) {
    throw new HTTPException(409, {
      message: "A developer with this email already exists",
    });
  }

  const { full, hash, preview } = generateApiKey();
  const [dev] = await db
    .insert(developers)
    .values({
      email: body.email,
      apiKeyHash: hash,
      apiKeyPreview: preview,
    })
    .returning();

  return c.json(
    {
      id: dev.id,
      email: dev.email,
      apiKey: full,
      apiKeyPreview: dev.apiKeyPreview,
      createdAt: dev.createdAt.toISOString(),
      warning: "Save this apiKey now — it will not be shown again.",
    },
    201
  );
});

// GET /developers/me — current developer (from API key)
app.get("/me", async (c) => {
  const caller = c.get("caller");
  requireDeveloper(caller);
  return c.json({
    id: caller.developer.id,
    email: caller.developer.email,
    apiKeyPreview: caller.developer.apiKeyPreview,
    createdAt: caller.developer.createdAt.toISOString(),
  });
});

export default app;
