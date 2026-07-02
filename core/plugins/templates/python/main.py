"""enowx plugin (Python). Serves its UI + a small API on $PORT."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8000"))
HERE = os.path.dirname(os.path.abspath(__file__))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):  # quieter logs
        pass

    def do_GET(self):
        if self.path.startswith("/api/hello"):
            return self._json({"message": "Hello from your Python plugin!"})
        # Serve the UI.
        path = "public/index.html" if self.path in ("/", "") else self.path.lstrip("/")
        full = os.path.join(HERE, path)
        if os.path.isfile(full):
            ctype = "text/html" if full.endswith(".html") else "application/octet-stream"
            with open(full, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.end_headers()

    def _json(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)


print(f"plugin listening on :{PORT}", flush=True)
ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
