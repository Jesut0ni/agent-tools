import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export const httpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const toolAuthSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("bearer"),
    headerName: z.string().default("Authorization"),
  }),
  z.object({
    type: z.literal("agentgate"),
    scopes: z.array(z.string()).default([]),
  }),
]);

export const toolSpecSchema = z.object({
  endpoint: z.object({
    method: httpMethodSchema,
    url: z.string().url(),
  }),
  input: z.record(z.unknown()).default({}),
  output: z.record(z.unknown()).default({}),
  auth: toolAuthSchema.default({ type: "none" }),
  description: z.string().optional(),
  examples: z
    .array(
      z.object({
        input: z.unknown(),
        output: z.unknown().optional(),
      })
    )
    .optional(),
});

export const visibilitySchema = z.enum(["public", "private"]);

export const publishToolSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(128)
    .regex(slugPattern, "slug must be lowercase letters/digits separated by - or _"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i, "version must be semver"),
  visibility: visibilitySchema.default("public"),
  spec: toolSpecSchema,
});

export const publishVersionSchema = z.object({
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i, "version must be semver"),
  spec: toolSpecSchema,
});

export const listToolsQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type ToolSpec = z.infer<typeof toolSpecSchema>;
export type ToolAuth = z.infer<typeof toolAuthSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type PublishToolInput = z.infer<typeof publishToolSchema>;
export type PublishVersionInput = z.infer<typeof publishVersionSchema>;
export type ListToolsQuery = z.infer<typeof listToolsQuerySchema>;
