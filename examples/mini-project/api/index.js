import { createServer } from "node:http";
import { createConnection } from "node:net";

const PORT = parseInt(process.env.PORT || "3000", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function redisPing() {
  return new Promise((resolve) => {
    const port = parseInt(new URL(REDIS_URL).port || "6379", 10);
    const host = new URL(REDIS_URL).hostname || "localhost";
    const socket = createConnection(port, host, () => {
      socket.write("PING\r\n");
    });
    let data = "";
    socket.on("data", (chunk) => {
      data += chunk.toString();
      socket.destroy();
    });
    socket.on("close", () => {
      resolve(data.includes("PONG"));
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", service: "api" }));
  } else if (req.url === "/health" && req.method === "GET") {
    const redisOk = await redisPing();
    res.writeHead(redisOk ? 200 : 503);
    res.end(JSON.stringify({ healthy: redisOk, redis: redisOk ? "connected" : "unreachable" }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
