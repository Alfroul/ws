import type { Command } from "commander";
import chalk from "chalk";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { load as yamlLoad } from "js-yaml";
import { execSync } from "node:child_process";
import type { ProcessServiceConfig, DockerServiceConfig } from "@ws/config";

export function registerShellCommand(program: Command): void {
  program
    .command("shell <service>")
    .description("Open a shell in the service's working directory")
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
        const serviceConfig = services[serviceName] as
          | ProcessServiceConfig
          | DockerServiceConfig
          | undefined;

        if (!serviceConfig) {
          console.error(chalk.red(`Service "${serviceName}" not found in workspace.yaml`));
          process.exit(1);
        }

        if (serviceConfig.type === "docker") {
          console.error(
            chalk.yellow(
              `Service "${serviceName}" is a Docker service. Use "docker exec -it <container> sh" instead.`,
            ),
          );
          process.exit(1);
        }

        const workdir = serviceConfig.workdir
          ? resolve(workspaceDir, serviceConfig.workdir)
          : resolve(workspaceDir, serviceName);

        const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
        const env = { ...process.env, ...(serviceConfig.env ?? {}) };

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
