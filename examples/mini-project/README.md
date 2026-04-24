# Mini Project Demo

A minimal example demonstrating **ws** workspace service management.

## What It Does

- **redis** — Redis 7 container on port 6379
- **api** — Node.js HTTP API on port 3000, connects to Redis via TCP
- **worker** — Background worker that writes heartbeats to Redis every 5s

The api and worker both depend on redis, so `ws start` launches them only after redis is healthy.

## Quick Start

```bash
cd examples/mini-project
ws start
```

## Verify

```bash
# API root
curl http://localhost:3000/
# {"status":"ok","service":"api"}

# Health check (tests Redis connectivity)
curl http://localhost:3000/health
# {"healthy":true,"redis":"connected"}
```

## Stop

```bash
ws stop
```
