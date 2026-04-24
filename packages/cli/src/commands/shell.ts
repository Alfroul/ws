import type { Command } from "commander";
import chalk from "chalk";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { load as yamlLoad } from "js-yaml";
import { execSync } from "node:child_process";
import type { ProcessServiceConfig, DockerServiceConfig } from "@alfroul/config";
import { loadState } from "@alfroul/core";

function redactEnv(env: Record<string, string>): Record<string, string> {
  const secretPattern = /SECRET|KEY|PASSWORD|TOKEN|PRIVATE/i;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    result[key] = secretPattern.test(key) ? "****" : value;
  }
  return result;
}

export function registerShellCommand(program: Command): void {
  program
    .command("shell <service>")
    .description("Open a shell in the service's working directory")
    .option("--cmd <command>", "Execute a single command non-interactively")
    .action(async (serviceName: string, options: { cmd?: string }) => {
      const workspaceDir = process.cwd();
      const yamlPath = resolve(workspaceDir, "workspace.yaml");

      try {
        const raw = await readFile(yamlPath, "utf-8");
        const config = yamlLoad(raw) as Record<string, unknown>;

        if (!config.services || typeof config.services !== "object") {
          console.error(chalk.red("No services found in workspace.yaml"));
          process.exit(1);
        }

        const services = config.services as Record<string, unknown>;
        const serviceConfig = services[serviceName] as
          | ProcessServiceConfig
          | DockerServiceConfig
          | undefined;

        if (!serviceConfig) {
          console.error(chalk.red(`Service "${serviceName}" not found in workspace.yaml`));
          process.exit(1);
        }

        if (serviceConfig.type === "docker") {
          const state = await loadState(workspaceDir);
          const serviceState = state.services[serviceName];

          if (!serviceState?.containerId) {
            console.error(
              chalk.red(
                `No running container found for service "${serviceName}". Run "ws start" first.`,
              ),
            );
            process.exit(1);
          }

          const containerId = serviceState.containerId;

          if (options.cmd) {
            execSync(`docker exec ${containerId} sh -c ${JSON.stringify(options.cmd)}`, {
              stdio: "inherit",
            });
          } else {
            console.log(chalk.gray(`Attaching to container ${containerId.slice(0, 12)} ...`));
            execSync(`docker exec -it ${containerId} sh`, { stdio: "inherit" });
          }
          return;
        }

        const workdir = serviceConfig.workdir
          ? resolve(workspaceDir, serviceConfig.workdir)
          : resolve(workspaceDir, serviceName);

        const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
        const env = { ...process.env, ...(serviceConfig.env ?? {}) } as Record<string, string>;

        if (options.cmd) {
          execSync(options.cmd, { cwd: workdir, stdio: "inherit", env });
          return;
        }

        if (serviceConfig.env && Object.keys(serviceConfig.env).length > 0) {
          const redacted = redactEnv(serviceConfig.env);
          const lines = Object.entries(redacted)
            .map(([key, value]) => `  ${key}=${value}`)
            .join("\n");
          console.log(chalk.gray(`[ws] Environment for service "${serviceName}":\n${lines}`));
        }

        console.log(chalk.gray(`Opening shell in ${workdir} ...`));
        execSync(shell, {
          cwd: workdir,
          stdio: "inherit",
          env,
        });
      } catch (err) {
        const exitStatus = (err as Record<string, unknown>)?.status;
        if (typeof exitStatus === "number") {
          process.exit(exitStatus);
        }
        if (err instanceof Error && err.message.includes("ENOENT")) {
          console.error(chalk.red(`workspace.yaml not found in ${workspaceDir}`));
        } else {
          console.error(
            chalk.red(`Error opening shell: ${err instanceof Error ? err.message : err}`),
          );
        }
        process.exit(1);
      }
    });
}
