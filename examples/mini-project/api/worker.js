import { createConnection } from "node:net";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function redisSet(key, value) {
  return new Promise((resolve) => {
    const port = parseInt(new URL(REDIS_URL).port || "6379", 10);
    const host = new URL(REDIS_URL).hostname || "localhost";
    const socket = createConnection(port, host, () => {
      socket.write(`SET ${key} "${value}"\r\n`);
    });
    let data = "";
    socket.on("data", (chunk) => {
      data += chunk.toString();
      socket.destroy();
    });
    socket.on("close", () => resolve(data.includes("OK")));
    socket.on("error", () => resolve(false));
    socket.setTimeout(2000, () => { socket.destroy(); resolve(false); });
  });
}

console.log("Worker started");
let lastOk = false;
const heartbeat = setInterval(async () => {
  const ts = new Date().toISOString();
  const ok = await redisSet("worker:heartbeat", ts);
  if (ok !== lastOk) {
    console.log(ok ? "Redis connected" : "Redis unreachable");
    lastOk = ok;
  }
}, 5000);

function shutdown(signal) {
  console.log(`Worker received ${signal}, shutting down`);
  clearInterval(heartbeat);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
