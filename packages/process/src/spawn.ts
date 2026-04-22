import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  logPath?: string;
}

export interface SpawnResult {
  pid: number;
  process: ChildProcess;
}

/**
 * Parse a command string into executable + args.
 * Handles basic quoting (double-quoted segments).
 */
function parseCommand(command: string): { cmd: string; args: string[] } {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const ch of command) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === " " && !inQuotes) {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  return { cmd: parts[0], args: parts.slice(1) };
}

/**
 * Spawn a child process, optionally piping stdout/stderr to a log file.
 */
export function spawnCommand(
  command: string,
  options: SpawnOptions = {},
): SpawnResult {
  const { cwd, env, logPath } = options;
  const { cmd, args } = parseCommand(command);

  const spawnEnv = { ...process.env, ...env };

  // On Windows, wrap with cmd /c for shell commands
  const useCmd = process.platform === "win32";
  const finalCmd = useCmd ? "cmd" : cmd;
  const finalArgs = useCmd ? ["/c", cmd, ...args] : args;

  const child = spawn(finalCmd, finalArgs, {
    cwd,
    env: spawnEnv,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  // Pipe to log file if path provided
  if (logPath) {
    mkdir(dirname(logPath), { recursive: true }).then(() => {
      const logStream = createWriteStream(logPath, { flags: "a" });
      child.stdout?.pipe(logStream);
      child.stderr?.pipe(logStream);
    });
  }

  // Also pipe to parent for visibility
  child.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(data);
  });
  child.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(data);
  });

  return { pid: child.pid!, process: child };
}
