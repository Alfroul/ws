import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConfig, ConfigParseError } from "../src/parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../../../tests/fixtures");

describe("parseConfig", () => {
  it("parses a valid workspace.yaml with all field types", async () => {
    const config = await parseConfig(resolve(fixtures, "valid-workspace.yaml"));

    expect(config.version).toBe(1);
    expect(config.name).toBe("test-workspace");
    expect(Object.keys(config.services)).toContain("api");
    expect(Object.keys(config.services)).toContain("db");

    const api = config.services.api;
    expect(api.type).toBe("process");
    if (api.type === "process") {
      expect(api.repo).toBe("https://github.com/example/api.git");
      expect(api.branch).toBe("main");
      expect(api.setup).toBe("npm install");
      expect(api.start).toBe("npm start");
      expect(api.env).toEqual({ PORT: "3000" });
      expect(api.depends_on).toEqual(["db"]);
    }

    const db = config.services.db;
    expect(db.type).toBe("docker");
    if (db.type === "docker") {
      expect(db.image).toBe("postgres:15");
      expect(db.ports).toEqual(["5432:5432"]);
      expect(db.health_check?.type).toBe("http");
    }

    expect(config.hooks?.post_setup).toEqual(['echo "setup done"']);
    expect(config.hooks?.pre_start).toEqual(['echo "starting"']);
  });

  it("throws ConfigParseError for missing file", async () => {
    await expect(parseConfig(resolve(fixtures, "nonexistent.yaml"))).rejects.toThrow(
      ConfigParseError,
    );
    await expect(parseConfig(resolve(fixtures, "nonexistent.yaml"))).rejects.toThrow(
      "Config file not found",
    );
  });

  it("throws ConfigParseError for missing required field (name)", async () => {
    await expect(parseConfig(resolve(fixtures, "missing-name.yaml"))).rejects.toThrow(
      ConfigParseError,
    );
    try {
      await parseConfig(resolve(fixtures, "missing-name.yaml"));
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigParseError);
      const parsed = err as ConfigParseError;
      expect(parsed.details).toBeDefined();
      expect(parsed.details!.length).toBeGreaterThan(0);
      const hasNameError = parsed.details!.some((d) => d.includes("name"));
      expect(hasNameError).toBe(true);
    }
  });

  it("throws ConfigParseError for invalid service type", async () => {
    await expect(parseConfig(resolve(fixtures, "wrong-type.yaml"))).rejects.toThrow(
      ConfigParseError,
    );
    try {
      await parseConfig(resolve(fixtures, "wrong-type.yaml"));
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigParseError);
      const parsed = err as ConfigParseError;
      const hasTypeError = parsed.details!.some((d) => d.includes("type"));
      expect(hasTypeError).toBe(true);
    }
  });

  it("resolves $env variables during parsing", async () => {
    process.env.DB_HOST = "localhost";
    process.env.DB_PORT = "5432";
    process.env.API_KEY = "my-secret-key";

    try {
      const config = await parseConfig(resolve(fixtures, "env-workspace.yaml"));
      const web = config.services.web;
      if (web.type === "process") {
        expect(web.env?.DB_HOST).toBe("localhost");
        expect(web.env?.DB_PORT).toBe("5432");
        expect(web.env?.API_KEY).toBe("my-secret-key");
      }
    } finally {
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.API_KEY;
    }
  });

  it("resolves extends inheritance during parsing", async () => {
    const config = await parseConfig(resolve(fixtures, "extended-config.yaml"));

    expect(config.name).toBe("extended-workspace");
    expect(Object.keys(config.services)).toHaveLength(3);
    expect(Object.keys(config.services)).toContain("api");
    expect(Object.keys(config.services)).toContain("db");
    expect(Object.keys(config.services)).toContain("cache");

    const api = config.services.api;
    if (api.type === "process") {
      expect(api.start).toBe("npm start");
      expect(api.env?.NODE_ENV).toBe("production");
      expect(api.env?.PORT).toBe("8080");
    }

    const cache = config.services.cache;
    if (cache.type === "docker") {
      expect(cache.image).toBe("redis:7");
    }
  });
});
