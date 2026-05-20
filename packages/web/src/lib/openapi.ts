// Minimal OpenAPI 3.x parser — turns a spec into a list of tool candidates.

export interface ToolCandidate {
  slug: string;
  name: string;
  description: string;
  method: string;
  url: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  auth: "none" | "bearer";
  warnings: string[];
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

function kebab(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function resolveRef(spec: any, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;
  const parts = ref.slice(2).split("/");
  let cur: any = spec;
  for (const p of parts) {
    if (cur && typeof cur === "object") cur = cur[p];
    else return undefined;
  }
  return cur;
}

function deref(spec: any, value: any): any {
  if (!value || typeof value !== "object") return value;
  if (typeof value.$ref === "string") {
    const resolved = resolveRef(spec, value.$ref);
    return resolved ?? value;
  }
  return value;
}

function buildInputSchema(spec: any, op: any, pathParams: any[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const raw of [...(op.parameters ?? []), ...pathParams]) {
    const param = deref(spec, raw);
    if (!param || !param.name || (param.in !== "query" && param.in !== "path")) continue;
    properties[param.name] = deref(spec, param.schema) ?? { type: "string" };
    if (param.required) required.push(param.name);
  }

  const requestBody = deref(spec, op.requestBody);
  if (requestBody?.content?.["application/json"]?.schema) {
    const bodySchema = deref(spec, requestBody.content["application/json"].schema);
    if (bodySchema?.type === "object" && bodySchema.properties) {
      Object.assign(properties, bodySchema.properties);
      if (Array.isArray(bodySchema.required)) required.push(...bodySchema.required);
    } else if (bodySchema) {
      properties["body"] = bodySchema;
      if (requestBody.required) required.push("body");
    }
  }

  const schema: Record<string, unknown> = { type: "object", properties };
  if (required.length) schema.required = Array.from(new Set(required));
  return schema;
}

function buildOutputSchema(spec: any, op: any): Record<string, unknown> {
  const responses = op.responses ?? {};
  for (const code of ["200", "201", "default"]) {
    const r = deref(spec, responses[code]);
    const schema = r?.content?.["application/json"]?.schema;
    if (schema) return (deref(spec, schema) as Record<string, unknown>) ?? { type: "object" };
  }
  return { type: "object" };
}

function detectAuth(spec: any, op: any): "none" | "bearer" {
  const sec = op.security ?? spec.security;
  if (!sec || sec.length === 0) return "none";
  const schemes = spec.components?.securitySchemes ?? {};
  for (const requirement of sec) {
    for (const schemeName of Object.keys(requirement)) {
      const scheme = schemes[schemeName];
      if (
        scheme?.type === "http" &&
        (scheme.scheme === "bearer" || scheme.scheme === "Bearer")
      ) {
        return "bearer";
      }
    }
  }
  return "none";
}

export function parseOpenApi(input: string): {
  info: { title: string; version: string };
  candidates: ToolCandidate[];
} {
  let spec: any;
  try {
    spec = JSON.parse(input);
  } catch (err) {
    throw new Error(`OpenAPI spec is not valid JSON: ${(err as Error).message}`);
  }

  if (!spec.openapi && !spec.swagger) {
    throw new Error("Not an OpenAPI spec (missing `openapi` or `swagger` field).");
  }
  if (spec.swagger) {
    throw new Error("Swagger 2.0 specs are not supported yet — please use OpenAPI 3.x.");
  }

  const serverUrl = spec.servers?.[0]?.url ?? "";
  const info = {
    title: spec.info?.title ?? "openapi-import",
    version: spec.info?.version ?? "0.1.0",
  };
  const titleSlug = kebab(info.title);

  const candidates: ToolCandidate[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    const pi = pathItem as any;
    const sharedParams = pi.parameters ?? [];

    for (const method of HTTP_METHODS) {
      const op = pi[method];
      if (!op) continue;
      const warnings: string[] = [];
      const url = joinUrl(serverUrl, path);
      if (url.includes("{")) {
        warnings.push("Path templating not yet supported by the proxy — edit before publishing.");
      }
      if (!serverUrl) {
        warnings.push("No server URL in spec; using the bare path. Edit before publishing.");
      }

      const opId = typeof op.operationId === "string" ? op.operationId : `${method}-${path}`;
      const slug = kebab(`${titleSlug}-${opId}`).slice(0, 120);

      candidates.push({
        slug,
        name:
          (typeof op.summary === "string" && op.summary) ||
          (typeof op.operationId === "string" && op.operationId) ||
          `${method.toUpperCase()} ${path}`,
        description:
          (typeof op.description === "string" && op.description) ||
          (typeof op.summary === "string" && op.summary) ||
          "",
        method: method.toUpperCase(),
        url,
        input: buildInputSchema(spec, op, sharedParams),
        output: buildOutputSchema(spec, op),
        auth: detectAuth(spec, op),
        warnings,
      });
    }
  }

  return { info, candidates };
}
