import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: err.status, message: err.message } },
      err.status
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: 400,
          message: "Validation failed",
          details: err.flatten(),
        },
      },
      400
    );
  }

  logger.error({ err }, "Unhandled error");
  return c.json(
    { error: { code: 500, message: "Internal server error" } },
    500
  );
};
