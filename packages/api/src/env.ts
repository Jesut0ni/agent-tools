import { z } from "zod";

const envSchema = z.object({
  DATABASE_PATH: z.string().default("./agent-tools.db"),
  API_PORT: z.coerce.number().default(3002),
  API_URL: z.string().default("http://localhost:3002"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CALL_TIMEOUT_MS: z.coerce.number().default(30_000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    ),
  RATE_LIMIT_READ_PER_MINUTE: z.coerce.number().default(240),
  RATE_LIMIT_WRITE_PER_MINUTE: z.coerce.number().default(20),
  RATE_LIMIT_CALL_PER_MINUTE: z.coerce.number().default(60),
  AGENTGATE_JWT_SECRET: z
    .string()
    .default("dev-secret-change-this-in-production-please-1234"),
  AGENTGATE_JWT_ISSUER: z.string().default("agentgate"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
      process.exit(1);
    }
    _env = result.data;
  }
  return _env;
}
