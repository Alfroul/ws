import { describe, it, expect, vi } from "vitest";
import { outputResult } from "../src/ui/output.js";
import type { GlobalOptions } from "../src/ui/output.js";

describe("outputResult", () => {
  it("outputs JSON on success when json flag is set", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    outputResult({ json: true } as GlobalOptions, {
      success: true,
      command: "setup",
      message: "Done",
      data: { workspace: "test" },
    });
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.success).toBe(true);
    expect(output.command).toBe("setup");
    expect(output.workspace).toBe("test");
    spy.mockRestore();
  });

  it("outputs JSON on failure when json flag is set", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    outputResult({ json: true } as GlobalOptions, {
      success: false,
      command: "start",
      error: "Something broke",
    });
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output.success).toBe(false);
    expect(output.error).toBe("Something broke");
    spy.mockRestore();
  });

  it("outputs colored text in normal mode on success", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    outputResult({}, {
      success: true,
      command: "setup",
      message: "Setup complete",
    });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toContain("Setup complete");
    spy.mockRestore();
  });

  it("outputs colored error in normal mode on failure", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    outputResult({}, {
      success: false,
      command: "start",
      error: "Start failed: timeout",
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
