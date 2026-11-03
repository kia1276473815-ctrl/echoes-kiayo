# Build helper: serves the deck on localhost and lets tools/encode.html write compressed assets into _build/.
# Usage: python tools/build_server.py   then open http://localhost:8775/tools/encode.html
import http.server
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_build")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

    def do_PUT(self):
        m = re.fullmatch(r"/_build/([\w\-./]+)", self.path)
        if not m or ".." in m.group(1):
            self.send_error(400)
            return
        dst = os.path.join(OUT, *m.group(1).split("/"))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "wb") as f:
            f.write(self.rfile.read(int(self.headers["Content-Length"])))
        self.send_response(204)
        self.end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8775
print(f"http://localhost:{port}/tools/encode.html")
http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
