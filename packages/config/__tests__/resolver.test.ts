import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVariables, resolveExtends } from "../src/resolver.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(__dirname, "../../../tests/fixtures");

describe("resolveVariables", () => {
  it("replaces $env:VAR_NAME with process.env value", () => {
    process.env.TEST_VAR = "hello";
    try {
      const result = resolveVariables({ value: "$env:TEST_VAR" }) as { value: string };
      expect(result.value).toBe("hello");
    } finally {
      delete process.env.TEST_VAR;
    }
  });

  it("replaces multiple env vars in a single string", () => {
    process.env.HOST = "db.example.com";
    process.env.PORT = "3306";
    try {
      const result = resolveVariables({
        url: "mysql://$env:HOST:$env:PORT/mydb",
      }) as { url: string };
      expect(result.url).toBe("mysql://db.example.com:3306/mydb");
    } finally {
      delete process.env.HOST;
      delete process.env.PORT;
    }
  });

  it("gives empty string for missing env vars", () => {
    const result = resolveVariables({ value: "$env:NONEXISTENT_VAR" }) as { value: string };
    expect(result.value).toBe("");
  });

  it("recursively resolves nested objects", () => {
    process.env.KEY1 = "val1";
    process.env.KEY2 = "val2";
    try {
      const result = resolveVariables({
        services: {
          api: {
            env: {
              KEY1: "$env:KEY1",
              KEY2: "$env:KEY2",
            },
          },
        },
      }) as { services: { api: { env: Record<string, string> } } };
      expect(result.services.api.env.KEY1).toBe("val1");
      expect(result.services.api.env.KEY2).toBe("val2");
    } finally {
      delete process.env.KEY1;
      delete process.env.KEY2;
    }
  });

  it("resolves arrays containing env vars", () => {
    process.env.PORT = "8080";
    try {
      const result = resolveVariables({ ports: ["$env:PORT:80"] }) as { ports: string[] };
      expect(result.ports[0]).toBe("8080:80");
    } finally {
      delete process.env.PORT;
    }
  });

  it("returns primitives unchanged", () => {
    expect(resolveVariables(42)).toBe(42);
    expect(resolveVariables(true)).toBe(true);
    expect(resolveVariables(null)).toBe(null);
    expect(resolveVariables("plain string")).toBe("plain string");
  });
});

describe("resolveExtends", () => {
  it("returns original config when no extends field", async () => {
    const raw = { version: 1, name: "test", services: {} };
    const result = await resolveExtends(raw, fixtures);
    expect(result).toEqual(raw);
  });

  it("deep merges services from base config", async () => {
    const raw = {
      version: 1,
      name: "extended-workspace",
      extends: "./base-config.yaml",
      services: {
        api: {
          env: { NODE_ENV: "production", PORT: "8080" },
        },
        cache: {
          type: "docker",
          image: "redis:7",
        },
      },
    };

    const result = await resolveExtends(raw, fixtures) as {
      services: Record<string, Record<string, unknown>>;
      hooks: Record<string, string[]>;
    };

    expect(result.services.api).toBeDefined();
    expect(result.services.api.start).toBe("npm start");
    expect(result.services.api.env).toEqual({ NODE_ENV: "production", PORT: "8080" });
    expect(result.services.cache).toBeDefined();
    expect(result.services.db).toBeDefined();
    expect(result.hooks?.post_setup).toEqual(['echo "base setup"']);
  });

  it("throws on circular extends", async () => {
    const raw = {
      version: 1,
      name: "cyclic-extends-a",
      extends: "./cyclic-extends-b.yaml",
      services: { svc: { type: "process", start: "echo a" } },
    };

    await expect(resolveExtends(raw, fixtures)).rejects.toThrow("Circular extends detected");
  });
});
