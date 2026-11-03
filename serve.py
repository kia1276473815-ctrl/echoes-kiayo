# Local server for the deck. No caching, so edits to config.js show up on reload.
import http.server
import os
import socket
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8765
# --lan: also reachable from a phone on the same Wi-Fi
lan = "--lan" in sys.argv
if lan:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))   # no packet is sent; this only picks the Wi-Fi interface
        ip = s.getsockname()[0]
    except OSError:
        ip = "127.0.0.1"
    finally:
        s.close()
    print(f"phone (same Wi-Fi): http://{ip}:{port}/")
print(f"this computer: http://localhost:{port}/")
http.server.ThreadingHTTPServer(("0.0.0.0" if lan else "127.0.0.1", port), Handler).serve_forever()
