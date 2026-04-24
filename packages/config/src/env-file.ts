import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

/**
 * Parse a .env file content into a key-value map.
 * Supports:
 * - KEY=VALUE
 * - # comments
 * - Quoted values (single and double)
 * - Empty lines
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (line === "" || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key.length > 0) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Load a .env file and merge its values into the service env.
 * YAML env values take precedence over .env file values.
 * @param envFilePath - Path to the .env file (relative to baseDir or absolute)
 * @param baseDir - Directory to resolve relative paths against
 * @param existingEnv - Existing env from YAML config (takes precedence)
 */
export function loadEnvFile(
  envFilePath: string,
  baseDir: string,
  existingEnv?: Record<string, string>,
): Record<string, string> {
  const absolutePath = resolve(baseDir, envFilePath);

  let content: string;
  try {
    content = readFileSync(absolutePath, "utf-8");
  } catch {
    throw new Error(`Failed to read env file: ${absolutePath}`);
  }

  const fileEnv = parseEnvContent(content);

  // .env values as defaults, YAML env overrides
  return { ...fileEnv, ...existingEnv };
}
