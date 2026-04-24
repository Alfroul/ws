import { z } from "zod";

export const ProcessServiceConfigSchema = z.object({
  type: z.literal("process"),
  repo: z.string().optional(),
  branch: z.string().optional(),
  setup: z.string().optional(),
  start: z.string(),
  env: z.record(z.string()).optional(),
  env_file: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
  workdir: z.string().optional(),
});

export const DockerServiceConfigSchema = z.object({
  type: z.literal("docker"),
  image: z.string(),
  ports: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  env_file: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
  health_check: z
    .object({
      type: z.enum(["http", "tcp"]),
      url: z.string().optional(),
      port: z.number().optional(),
      interval: z.number().optional(),
      timeout: z.number().optional(),
    })
    .optional(),
});

export const ServiceConfigSchema = z.discriminatedUnion("type", [
  ProcessServiceConfigSchema,
  DockerServiceConfigSchema,
]);

export const HookConfigSchema = z.object({
  post_setup: z.array(z.string()).optional(),
  pre_start: z.array(z.string()).optional(),
  post_start: z.array(z.string()).optional(),
  pre_stop: z.array(z.string()).optional(),
  post_stop: z.array(z.string()).optional(),
});

export const WorkspaceConfigSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  extends: z.string().optional(),
  services: z.record(ServiceConfigSchema),
  hooks: HookConfigSchema.optional(),
  plugins: z.array(z.string()).optional(),
});
