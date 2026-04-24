# Contributing to ws

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- **Node.js** >= 20
- **pnpm** (install via `corepack enable` or `npm install -g pnpm`)
- **Git**
- **Docker** (optional, needed for Docker-related tests)

## Setup

```bash
git clone https://github.com/Alfroul/ws.git
cd ws
pnpm install
pnpm build
```

## Development

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Run tests excluding git network tests (recommended for fast feedback)
npx vitest run --exclude "**/git/**"

# Type-check all packages
pnpm typecheck

# Clean build artifacts
pnpm clean
```

## Project Structure

```
ws/
├── packages/
│   ├── cli/              CLI entry point and commands
│   ├── core/             Engine, scheduler, lifecycle, state
│   ├── config/           YAML parser, Zod schemas, validator
│   ├── git/              Git clone/pull/status (isomorphic-git)
│   ├── docker/           Container lifecycle + health checks (dockerode)
│   ├── process/          Process manager + crash restart
│   ├── plugin-api/       Plugin loader + hook executor
│   └── utils/            Logger, spinner, fs utilities
├── plugins/
│   ├── notifications/    Desktop notification plugin
│   └── health-check/     HTTP health-check plugin
├── examples/
│   └── mini-project/     End-to-end demo project
└── tests/                Shared fixtures and helpers
```

## Code Style

- **TypeScript strict mode** — no `as any`, no `@ts-ignore`, no `@ts-expect-error`
- **ES Modules** — the project uses `"type": "module"` throughout
- Follow existing patterns in the codebase
- Keep changes focused — don't refactor unrelated code in the same PR

## Making Changes

1. Create a branch: `git checkout -b my-feature`
2. Make your changes with clear, atomic commits
3. Add or update tests for your changes
4. Run `pnpm typecheck` and `pnpm test` to verify
5. Push and open a Pull Request

## Commit Messages

Use clear, descriptive commit messages:

```
feat(cli): add --filter flag to ws logs
fix(process): correct restart counter reset on graceful exit
docs: update workspace.yaml reference
```

Prefixes: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## Pull Requests

- Fill out the PR template completely
- Include test results in the PR description
- Keep PRs focused on a single concern
- Respond to review feedback promptly

## Reporting Issues

Use the GitHub issue templates:

- **Bug report**: Include reproduction steps, expected vs actual behavior, and environment details
- **Feature request**: Describe the use case and proposed solution

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
