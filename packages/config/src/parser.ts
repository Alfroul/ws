import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import yaml from "js-yaml";
import { WorkspaceConfigSchema } from "./schema.js";
import { resolveVariables } from "./resolver.js";
import { resolveExtends } from "./resolver.js";
import type { WorkspaceConfig } from "./types.js";

export class ConfigParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "ConfigParseError";
  }
}

/**
 * Parse and validate a workspace.yaml config file.
 * Steps: read YAML → resolve extends → resolve $env variables → validate with Zod
 */
export async function parseConfig(filePath: string): Promise<WorkspaceConfig> {
  const absolutePath = resolve(filePath);

  let raw: unknown;
  try {
    const content = readFileSync(absolutePath, "utf-8");
    raw = yaml.load(content);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ConfigParseError(
        `Config file not found: ${absolutePath}`,
        absolutePath,
      );
    }
    if (err instanceof yaml.YAMLException) {
      throw new ConfigParseError(
        `YAML syntax error in ${absolutePath}: ${err.message}`,
        absolutePath,
      );
    }
    throw new ConfigParseError(
      `Failed to read config file: ${absolutePath}`,
      absolutePath,
    );
  }

  if (typeof raw !== "object" || raw === null) {
    throw new ConfigParseError(
      `Config file must contain a YAML object, got ${typeof raw}`,
      absolutePath,
    );
  }

  const baseDir = dirname(absolutePath);
  const merged = await resolveExtends(raw as Record<string, unknown>, baseDir);

  const resolved = resolveVariables(merged);

  const result = WorkspaceConfigSchema.safeParse(resolved);
  if (!result.success) {
    const details = result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    throw new ConfigParseError(
      `Invalid config in ${absolutePath}:\n  ${details.join("\n  ")}`,
      absolutePath,
      details,
    );
  }

  return result.data;
}
