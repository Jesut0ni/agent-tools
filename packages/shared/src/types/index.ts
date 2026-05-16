import type { ToolSpec, Visibility } from "../schemas/tool.js";

export interface Tool {
  id: string;
  slug: string;
  name: string;
  description: string;
  ownerId: string | null;
  visibility: Visibility;
  latestVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToolVersion {
  id: string;
  toolId: string;
  version: string;
  spec: ToolSpec;
  createdAt: string;
}

export interface ToolWithLatest extends Tool {
  spec: ToolSpec | null;
}

export interface ToolCallResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
}
