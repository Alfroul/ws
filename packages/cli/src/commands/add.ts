import type { Command } from "commander";
import { input, select, confirm } from "@inquirer/prompts";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import yaml from "js-yaml";

export function registerAddCommand(program: Command): void {
  program
    .command("add")
    .description("Add a new service to the workspace")
    .option("-c, --config <path>", "Path to workspace.yaml")
    .action(async (options: { config?: string }) => {
      const configPath = resolve(options.config ?? "workspace.yaml");

      let existingYaml: string;
      try {
        existingYaml = await readFile(configPath, "utf-8");
      } catch {
        console.error(
          chalk.red(`Config file not found: ${configPath}`),
        );
        console.error(chalk.gray('Run "ws init" to create one.'));
        process.exit(1);
      }

      const serviceName = await input({
        message: "Service name:",
        validate: (v) => (v.trim() ? true : "Service name is required"),
      });

      const serviceType = (await select({
        message: "Service type:",
        choices: [
          { name: "Process (local command)", value: "process" },
          { name: "Docker (container)", value: "docker" },
        ],
      })) as "process" | "docker";

      let serviceConfig: Record<string, unknown>;

      if (serviceType === "process") {
        const repo = await input({
          message: "Git repo URL (leave empty if none):",
          default: "",
        });

        const startCommand = await input({
          message: "Start command:",
          validate: (v) => (v.trim() ? true : "Start command is required"),
        });

        const setupCommand = await input({
          message: "Setup command (leave empty if none):",
          default: "",
        });

        serviceConfig = {
          type: "process",
          start: startCommand,
        };

        if (repo.trim()) serviceConfig.repo = repo.trim();
        if (setupCommand.trim()) serviceConfig.setup = setupCommand.trim();

        const hasEnv = await confirm({
          message: "Add environment variables?",
          default: false,
        });
        if (hasEnv) {
          const envStr = await input({
            message: "Environment variables (KEY=VALUE, comma-separated):",
            default: "",
          });
          if (envStr.trim()) {
            const env: Record<string, string> = {};
            for (const pair of envStr.split(",")) {
              const [key, ...rest] = pair.split("=");
              if (key) env[key.trim()] = rest.join("=").trim();
            }
            serviceConfig.env = env;
          }
        }

        const hasDeps = await confirm({
          message: "Add service dependencies?",
          default: false,
        });
        if (hasDeps) {
          const depsStr = await input({
            message: "Depends on (comma-separated service names):",
            default: "",
          });
          if (depsStr.trim()) {
            serviceConfig.depends_on = depsStr
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }
      } else {
        const image = await input({
          message: "Docker image:",
          validate: (v) => (v.trim() ? true : "Docker image is required"),
        });

        const portsStr = await input({
          message: "Port mappings (e.g. 8080:80,443:443, leave empty if none):",
          default: "",
        });

        serviceConfig = {
          type: "docker",
          image: image.trim(),
        };

        if (portsStr.trim()) {
          serviceConfig.ports = portsStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }

        const hasHealthCheck = await confirm({
          message: "Add health check?",
          default: false,
        });
        if (hasHealthCheck) {
          const healthType = (await select({
            message: "Health check type:",
            choices: [
              { name: "HTTP", value: "http" },
              { name: "TCP", value: "tcp" },
            ],
          })) as "http" | "tcp";

          const healthCheck: Record<string, unknown> = { type: healthType };

          if (healthType === "http") {
            healthCheck.url = await input({
              message: "Health check URL:",
              default: `http://localhost:8080/health`,
            });
          } else {
            healthCheck.port = parseInt(
              await input({
                message: "Health check port:",
                default: "8080",
              }),
              10,
            );
          }

          serviceConfig.health_check = healthCheck;
        }
      }

      const parsed = yaml.load(existingYaml) as Record<string, unknown>;
      const services = (parsed.services ?? {}) as Record<string, unknown>;
      services[serviceName.trim()] = serviceConfig;
      parsed.services = services;

      const newYaml = yaml.dump(parsed, { lineWidth: -1, quotingType: '"' });
      await writeFile(configPath, newYaml, "utf-8");

      console.log(
        chalk.green(
          `✔ Service "${serviceName}" added to ${configPath}`,
        ),
      );
    });
}
