// enowx plugin (Node). Serves its UI + a small API on process.env.PORT.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "8000", 10);
const HERE = __dirname;

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/hello")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Hello from your Node plugin!" }));
    return;
  }
  const rel = req.url === "/" || req.url === "" ? "public/index.html" : req.url.replace(/^\//, "");
  const full = path.join(HERE, rel);
  if (fs.existsSync(full) && fs.statSync(full).isFile()) {
    const ctype = full.endsWith(".html") ? "text/html" : "application/octet-stream";
    res.writeHead(200, { "Content-Type": ctype });
    fs.createReadStream(full).pipe(res);
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, "127.0.0.1", () => console.log(`plugin listening on :${PORT}`));
