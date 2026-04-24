export interface ProcessServiceConfig {
  type: "process";
  repo?: string;
  branch?: string;
  setup?: string;
  start: string;
  env?: Record<string, string>;
  env_file?: string;
  depends_on?: string[];
  workdir?: string;
}

export interface DockerServiceConfig {
  type: "docker";
  image: string;
  ports?: string[];
  env?: Record<string, string>;
  env_file?: string;
  depends_on?: string[];
  health_check?: {
    type: "http" | "tcp";
    url?: string;
    port?: number;
    interval?: number;
    timeout?: number;
  };
}

export type ServiceConfig = ProcessServiceConfig | DockerServiceConfig;

export interface HookConfig {
  post_setup?: string[];
  pre_start?: string[];
  post_start?: string[];
  pre_stop?: string[];
  post_stop?: string[];
}

export interface WorkspaceConfig {
  version: 1;
  name: string;
  extends?: string;
  services: Record<string, ServiceConfig>;
  hooks?: HookConfig;
  plugins?: string[];
}
