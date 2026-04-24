import { createServer } from "node:http";

const PORT = parseInt(process.env.PORT || "3000", 10);

createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/") {
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
  }
}).listen(PORT, () => console.log(`Listening on port ${PORT}`));
