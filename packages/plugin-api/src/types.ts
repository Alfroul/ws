export interface WorkspaceConfig {
  version: number;
  name: string;
  services: Record<string, unknown>;
  hooks?: Record<string, string[]>;
  plugins?: string[];
}

export interface WsPlugin {
  name: string;
  onConfigLoaded?: (config: WorkspaceConfig) => Promise<void> | void;
  onBeforeSetup?: (config: WorkspaceConfig) => Promise<void> | void;
  onServiceReady?: (serviceName: string) => Promise<void> | void;
  onAllReady?: () => Promise<void> | void;
  onBeforeStop?: () => Promise<void> | void;
  commands?: Array<{
    name: string;
    description: string;
    action: (...args: unknown[]) => Promise<void> | void;
  }>;
}
