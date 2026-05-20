import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { HTTPException } from "hono/http-exception";

const ajv = new Ajv({
  strict: false,
  allErrors: true,
  validateFormats: true,
  allowUnionTypes: true,
});
addFormats(ajv);

/** Verifies the value itself is a valid JSON Schema (draft-07 meta-schema). */
export function validateJsonSchemaShape(schema: unknown, field: string): void {
  if (schema === null || typeof schema !== "object") {
    throw new HTTPException(400, { message: `${field} must be an object` });
  }
  const ok = ajv.validateSchema(schema as Record<string, unknown>);
  if (!ok) {
    const reason = ajv.errorsText(ajv.errors ?? null, { dataVar: field });
    throw new HTTPException(400, { message: `${field} is not a valid JSON Schema: ${reason}` });
  }
}

/** Returns null if `data` matches `schema`, otherwise a short error string. */
export function validateAgainstSchema(schema: unknown, data: unknown): string | null {
  if (schema === null || typeof schema !== "object") return null;
  if (Object.keys(schema as Record<string, unknown>).length === 0) return null;

  let validate;
  try {
    validate = ajv.compile(schema as Record<string, unknown>);
  } catch {
    return null;
  }
  if (validate(data)) return null;
  return formatErrors(validate.errors ?? []);
}

function formatErrors(errors: ErrorObject[]): string {
  return errors
    .slice(0, 5)
    .map((e) => `${e.instancePath || "(root)"} ${e.message ?? ""}`.trim())
    .join("; ");
}
