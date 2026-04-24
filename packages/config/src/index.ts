export { parseConfig, ConfigParseError } from "./parser.js";
export type {
  WorkspaceConfig,
  ServiceConfig,
  ProcessServiceConfig,
  DockerServiceConfig,
  HookConfig,
} from "./types.js";
export {
  WorkspaceConfigSchema,
  ServiceConfigSchema,
  ProcessServiceConfigSchema,
  DockerServiceConfigSchema,
  HookConfigSchema,
} from "./schema.js";
export { resolveVariables, resolveExtends, deepMerge } from "./resolver.js";
export { validateDependencies, detectCycle, CyclicDependencyError } from "./validator.js";
export { parseEnvContent, loadEnvFile } from "./env-file.js";
