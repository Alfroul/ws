import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnvContent, loadEnvFile } from "../src/env-file.js";

describe("parseEnvContent", () => {
  it("parses KEY=VALUE pairs", () => {
    const result = parseEnvContent("DB_HOST=localhost\nDB_PORT=5432\n");
    expect(result).toEqual({
      DB_HOST: "localhost",
      DB_PORT: "5432",
    });
  });

  it("skips comments", () => {
    const result = parseEnvContent("# This is a comment\nKEY=value\n");
    expect(result).toEqual({ KEY: "value" });
  });

  it("skips empty lines", () => {
    const result = parseEnvContent("\n\nKEY=value\n\n");
    expect(result).toEqual({ KEY: "value" });
  });

  it("handles double-quoted values", () => {
    const result = parseEnvContent('KEY="hello world"\n');
    expect(result).toEqual({ KEY: "hello world" });
  });

  it("handles single-quoted values", () => {
    const result = parseEnvContent("KEY='hello world'\n");
    expect(result).toEqual({ KEY: "hello world" });
  });

  it("skips lines without = sign", () => {
    const result = parseEnvContent("INVALID_LINE\nKEY=value\n");
    expect(result).toEqual({ KEY: "value" });
  });

  it("handles values with = signs", () => {
    const result = parseEnvContent("CONNECTION_STRING=host=localhost;port=5432\n");
    expect(result).toEqual({
      CONNECTION_STRING: "host=localhost;port=5432",
    });
  });

  it("handles empty value", () => {
    const result = parseEnvContent("EMPTY=\n");
    expect(result).toEqual({ EMPTY: "" });
  });
});

describe("loadEnvFile", () => {
  const tmpDir = resolve(".test-env-dir");

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads env from file and merges with existing env", () => {
    const envPath = resolve(tmpDir, ".env");
    writeFileSync(envPath, "FROM_FILE=yes\nOVERRIDDEN=original\n");

    const result = loadEnvFile(envPath, tmpDir, {
      OVERRIDDEN: "from_yaml",
    });

    expect(result).toEqual({
      FROM_FILE: "yes",
      OVERRIDDEN: "from_yaml",
    });
  });

  it("returns file env when no existing env provided", () => {
    const envPath = resolve(tmpDir, ".env");
    writeFileSync(envPath, "KEY=value\n");

    const result = loadEnvFile(envPath, tmpDir);

    expect(result).toEqual({ KEY: "value" });
  });

  it("resolves relative paths against baseDir", () => {
    writeFileSync(resolve(tmpDir, ".env"), "RELATIVE=yes\n");

    const result = loadEnvFile(".env", tmpDir);

    expect(result).toEqual({ RELATIVE: "yes" });
  });

  it("throws on missing file", () => {
    expect(() => loadEnvFile("nonexistent.env", tmpDir)).toThrow(
      "Failed to read env file",
    );
  });
});
