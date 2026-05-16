import pino from "pino";
import { getEnv } from "../env.js";

export const logger = pino({
  level: getEnv().LOG_LEVEL,
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true } },
});
