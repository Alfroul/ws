import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import { getLogFiles, formatLine, getServiceColor } from "../src/commands/logs-helper.js";

describe("getLogFiles", () => {
  const tmpDir = resolve(".test-logs-dir");

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when log dir does not exist", () => {
    const result = getLogFiles("/nonexistent/path");
    expect(result).toEqual([]);
  });

  it("returns specific service log file", () => {
    writeFileSync(resolve(tmpDir, "api.log"), "api log content");
    const result = getLogFiles(tmpDir, "api");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("api");
  });

  it("returns empty when specific service has no log", () => {
    const result = getLogFiles(tmpDir, "missing-service");
    expect(result).toEqual([]);
  });

  it("returns all log files sorted by name", () => {
    writeFileSync(resolve(tmpDir, "worker.log"), "worker");
    writeFileSync(resolve(tmpDir, "api.log"), "api");
    writeFileSync(resolve(tmpDir, "redis.log"), "redis");

    const result = getLogFiles(tmpDir);
    expect(result.map((f) => f.name)).toEqual(["api", "redis", "worker"]);
  });

  it("ignores non-.log files", () => {
    writeFileSync(resolve(tmpDir, "api.log"), "api");
    writeFileSync(resolve(tmpDir, "readme.txt"), "text");
    writeFileSync(resolve(tmpDir, "notes"), "notes");

    const result = getLogFiles(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("api");
  });
});

describe("formatLine", () => {
  it("formats line with service name prefix", () => {
    const result = formatLine("api", "server started", chalk.cyan);
    expect(result).toContain("[api]");
    expect(result).toContain("server started");
  });

  it("applies color function to prefix", () => {
    const result = formatLine("redis", "connected", chalk.green);
    expect(result).toContain("[redis]");
    expect(result).toContain("connected");
  });
});

describe("getServiceColor", () => {
  it("returns different colors for different indices", () => {
    const c0 = getServiceColor(0);
    const c1 = getServiceColor(1);
    expect(c0).not.toBe(c1);
  });

  it("cycles colors", () => {
    const c0 = getServiceColor(0);
    const c7 = getServiceColor(7);
    expect(c0).toBe(c7);
  });
});
