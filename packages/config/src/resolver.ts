import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import yaml from "js-yaml";

const ENV_VAR_PATTERN = /\$env:([A-Za-z_][A-Za-z0-9_]*)/g;

export function resolveVariables(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj.replace(ENV_VAR_PATTERN, (match, varName: string) => {
      const value = process.env[varName];
      if (value !== undefined) return value;
      return "";
    });
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveVariables(item));
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveVariables(value);
    }
    return result;
  }

  return obj;
}

export async function resolveExtends(
  raw: Record<string, unknown>,
  baseDir: string,
  visitedPaths: Set<string> = new Set(),
): Promise<Record<string, unknown>> {
  const extendsPath = raw.extends as string | undefined;
  if (!extendsPath) return raw;

  const absoluteExtendsPath = resolve(baseDir, extendsPath);
  const normalizedPath = absoluteExtendsPath.toLowerCase();

  if (visitedPaths.has(normalizedPath)) {
    const chain = [...visitedPaths, normalizedPath]
      .map((p) => {
        const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
        return p.substring(idx + 1);
      })
      .join(" → ");
    throw new Error(`Circular extends detected: ${chain}`);
  }

  visitedPaths.add(normalizedPath);

  let baseRaw: Record<string, unknown>;
  try {
    const content = readFileSync(absoluteExtendsPath, "utf-8");
    const parsed = yaml.load(content);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error(`Base config must be a YAML object: ${absoluteExtendsPath}`);
    }
    baseRaw = parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Circular extends")) {
      throw err;
    }
    throw new Error(
      `Failed to load extends file ${absoluteExtendsPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const resolvedBase = await resolveExtends(baseRaw, dirname(absoluteExtendsPath), visitedPaths);
  return deepMerge(resolvedBase, raw);
}

/**
 * Deep merge two objects. `overrides` values take precedence.
 * Services record is deep-merged (individual service configs are merged).
 * Other object fields are recursively merged. Non-object values from `overrides` win.
 */
export function deepMerge(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (key === "extends") continue;

    if (
      key === "services" &&
      typeof base.services === "object" &&
      base.services !== null &&
      typeof value === "object" &&
      value !== null
    ) {
      result.services = mergeServices(
        base.services as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }

    if (
      typeof base[key] === "object" &&
      base[key] !== null &&
      !Array.isArray(base[key]) &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = deepMerge(
        base[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }

    result[key] = value;
  }

  return result;
}

function mergeServices(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [serviceName, serviceConfig] of Object.entries(overrides)) {
    if (
      typeof base[serviceName] === "object" &&
      base[serviceName] !== null &&
      typeof serviceConfig === "object" &&
      serviceConfig !== null
    ) {
      result[serviceName] = {
        ...(base[serviceName] as Record<string, unknown>),
        ...(serviceConfig as Record<string, unknown>),
      };
    } else {
      result[serviceName] = serviceConfig;
    }
  }

  return result;
}
