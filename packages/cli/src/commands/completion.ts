import type { Command } from "commander";

export function registerCompletionCommand(program: Command): void {
  program
    .command("completion")
    .description("Output shell completion script")
    .action(() => {
      const commands = [
        "init",
        "setup",
        "start",
        "stop",
        "status",
        "add",
        "remove",
        "logs",
        "shell",
        "doctor",
        "completion",
      ];
      console.log(`# ws completion
_ws_completion() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="${commands.join(" ")}"
  COMPREPLY=($(compgen -W "$commands" -- "$cur"))
}
complete -F _ws_completion ws
`);
    });
}
