import { describe, it, expect } from "vitest";
import {
  canTransition,
  transition,
  type ServiceInstance,
  type ServiceStatus,
} from "../src/lifecycle.js";

describe("lifecycle", () => {
  function makeInstance(status: ServiceStatus): ServiceInstance {
    return {
      name: "test",
      config: { type: "process", start: "echo test" },
      status,
      restartCount: 0,
    };
  }

  describe("canTransition", () => {
    it("allows pending → setting_up", () => {
      expect(canTransition("pending", "setting_up")).toBe(true);
    });

    it("allows setting_up → ready", () => {
      expect(canTransition("setting_up", "ready")).toBe(true);
    });

    it("allows setting_up → crashed", () => {
      expect(canTransition("setting_up", "crashed")).toBe(true);
    });

    it("allows ready → running", () => {
      expect(canTransition("ready", "running")).toBe(true);
    });

    it("allows running → stopping", () => {
      expect(canTransition("running", "stopping")).toBe(true);
    });

    it("allows running → crashed", () => {
      expect(canTransition("running", "crashed")).toBe(true);
    });

    it("allows stopping → stopped", () => {
      expect(canTransition("stopping", "stopped")).toBe(true);
    });

    it("allows stopped → pending (restart)", () => {
      expect(canTransition("stopped", "pending")).toBe(true);
    });

    it("allows crashed → pending (restart)", () => {
      expect(canTransition("crashed", "pending")).toBe(true);
    });

    it("disallows invalid transitions", () => {
      expect(canTransition("pending", "running")).toBe(false);
      expect(canTransition("stopped", "running")).toBe(false);
      expect(canTransition("ready", "stopped")).toBe(false);
    });
  });

  describe("transition", () => {
    it("updates status on valid transition", () => {
      const instance = makeInstance("pending");
      transition(instance, "setting_up");
      expect(instance.status).toBe("setting_up");
    });

    it("throws on invalid transition", () => {
      const instance = makeInstance("pending");
      expect(() => transition(instance, "running")).toThrow(/Invalid/);
    });
  });
});
