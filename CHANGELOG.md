# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-04-24

### Added
- Declarative workspace configuration via `workspace.yaml`
- Topological dependency resolution with parallel scheduling
- Git service support (clone, pull, status via isomorphic-git)
- Docker service support (container lifecycle, port mapping, health checks)
- Process service support with auto-restart (exponential backoff, max 3 retries)
- Config inheritance via `extends` with deep-merge semantics
- Environment variable substitution (`$env:VAR` syntax)
- `.env` file loading and merging with YAML env precedence
- Plugin system with lifecycle hooks (`onConfigLoaded`, `onServiceReady`, `onAllReady`, etc.)
- Built-in plugins: health-check, notifications
- CLI commands: `init`, `setup`, `start`, `stop`, `status`, `logs`, `shell`, `doctor`, `add`, `remove`, `completion`
- Real-time log aggregation with `ws logs --tail`
- Crash recovery with persistent state (`.ws/state.json`)
- Atomic state writes for crash safety
- Graceful shutdown in reverse dependency order
- Cross-platform support (macOS, Linux, Windows)
- `ws doctor` for workspace diagnostics
- Configurable restart policy for process services
- Max restart reached alerting mechanism
