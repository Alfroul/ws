import type { Command } from "commander";
import chalk from "chalk";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import { loadState, removeServiceState } from "@alfroul/core";
import { confirm } from "@inquirer/prompts";

export function registerRemoveCommand(program: Command): void {
  program
    .command("remove <service>")
    .description("Remove a service from the workspace")
    .action(async (serviceName: string) => {
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

        if (!(serviceName in services)) {
          console.error(chalk.red(`Service "${serviceName}" not found in workspace.yaml`));
          process.exit(1);
        }

        const state = await loadState(workspaceDir);
        const serviceState = state.services[serviceName];

        if (serviceState && (serviceState.status === "running" || serviceState.status === "ready")) {
          console.log(chalk.yellow(`Service "${serviceName}" is currently running (status: ${serviceState.status})`));
          const shouldStop = await confirm({
            message: `Stop the service before removing?`,
            default: true,
          });
          if (shouldStop) {
            await removeServiceState(workspaceDir, serviceName);
          }
        }

        delete services[serviceName];
        const updatedYaml = yamlDump(config, { lineWidth: -1 });
        await writeFile(yamlPath, updatedYaml, "utf-8");

        const logPath = resolve(workspaceDir, ".ws", "logs", `${serviceName}.log`);
        try {
          await unlink(logPath);
        } catch {
          // Log file may not exist
        }

        console.log(chalk.green(`✓ Service "${serviceName}" removed from workspace.yaml`));
      } catch (err) {
        console.error(
          chalk.red(`Error removing service: ${err instanceof Error ? err.message : err}`),
        );
        process.exit(1);
      }
    });
}
