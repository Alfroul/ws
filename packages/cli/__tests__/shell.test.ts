import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";

vi.mock("@alfroul/core", () => ({
  loadState: vi.fn(),
}));

// Replicate the private redactEnv logic from shell.ts for unit testing
const secretPattern = /SECRET|KEY|PASSWORD|TOKEN|PRIVATE/i;

function redactEnv(env: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    result[key] = secretPattern.test(key) ? "****" : value;
  }
  return result;
}

describe("redactEnv", () => {
  it("redacts keys containing SECRET", () => {
    expect(redactEnv({ API_SECRET: "mysecret" })).toEqual({ API_SECRET: "****" });
  });

  it("redacts keys containing KEY", () => {
    expect(redactEnv({ API_KEY: "abc" })).toEqual({ API_KEY: "****" });
  });

  it("redacts keys containing PASSWORD", () => {
    expect(redactEnv({ DB_PASSWORD: "pass" })).toEqual({ DB_PASSWORD: "****" });
  });

  it("redacts keys containing TOKEN", () => {
    expect(redactEnv({ AUTH_TOKEN: "tok" })).toEqual({ AUTH_TOKEN: "****" });
  });

  it("redacts keys containing PRIVATE", () => {
    expect(redactEnv({ PRIVATE_KEY: "pk" })).toEqual({ PRIVATE_KEY: "****" });
  });

  it("does not redact normal keys", () => {
    const env = { PORT: "3000", HOST: "localhost" };
    expect(redactEnv(env)).toEqual(env);
  });

  it("handles empty env", () => {
    expect(redactEnv({})).toEqual({});
  });

  it("is case insensitive", () => {
    expect(redactEnv({ api_key: "abc", Secret_Value: "x" })).toEqual({
      api_key: "****",
      Secret_Value: "****",
    });
  });

  it("mixed env redacts only sensitive keys", () => {
    const result = redactEnv({
      PORT: "3000",
      API_KEY: "abc",
      HOST: "localhost",
      DB_PASSWORD: "pass",
    });
    expect(result).toEqual({
      PORT: "3000",
      API_KEY: "****",
      HOST: "localhost",
      DB_PASSWORD: "****",
    });
  });
});

describe("shell command registration", () => {
  it("registers shell command with service argument", async () => {
    const { registerShellCommand } = await import("../src/commands/shell.js");
    const program = new Command();
    registerShellCommand(program);
    const shellCmd = program.commands.find((cmd) => cmd.name() === "shell");
    expect(shellCmd).toBeDefined();
    // Commander stores <service> as a required argument in ._args
    expect(shellCmd!._args.length).toBeGreaterThanOrEqual(1);
  });

  it("has --cmd option registered", async () => {
    const { registerShellCommand } = await import("../src/commands/shell.js");
    const program = new Command();
    registerShellCommand(program);
    const shellCmd = program.commands.find((cmd) => cmd.name() === "shell");
    expect(shellCmd).toBeDefined();
    const hasCmdOption = shellCmd!.options.some(
      (opt) => opt.long === "--cmd",
    );
    expect(hasCmdOption).toBe(true);
  });
});
