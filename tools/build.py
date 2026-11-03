# Packs the whole deck into one self-contained HTML file (dist/Echoes_Kiayo.html) that runs offline by
# double-clicking: on the presentation PC (Chrome / Edge) or on an Android phone (Chrome).
#
#   1. python tools/build.py scan          -> _build/manifest.json (what to compress)
#   2. python tools/build_server.py         and open http://localhost:8775/tools/encode.html in Chrome
#                                           -> music to AAC, photos to display size, in _build/
#   3. python tools/build.py pack          -> dist/Echoes_Kiayo.html
#
# Step 2 only needs repeating when music or pictures change; after editing text or code, run step 3 alone.
import base64
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "_build")
DIST = os.path.join(ROOT, "dist")
OUT_NAME = "Echoes_Kiayo.html"
P = lambda *a: os.path.join(ROOT, *a)
read = lambda *a: open(P(*a), encoding="utf-8").read()

# pictures that fill the screen keep full width; the rest only need what the layout shows
FULL = {"kelso", "am-portrait", "fp-coachella-2017", "bialik-berlin-1920"}
MIME = {".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".aac": "audio/aac", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".wav": "audio/wav",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def used_assets():
    html = read("index.html")
    paths = set(re.findall(r'src="((?:assets)/[^"]+)"', html))
    paths |= {f"assets/covers/{f}" for f in os.listdir(P("assets", "covers"))}
    paths |= {f"assets/audio/{f}" for f in os.listdir(P("assets", "audio")) if f.endswith(".m4a")}
    paths |= {f"audio/mine/{f}" for f in os.listdir(P("audio", "mine"))}
    # 3D scans and the cut-out collage (Prokofiev page), packed as they are
    paths |= {f"assets/collage/{f}" for f in os.listdir(P("assets", "collage")) if f.endswith(".webp")}
    for d, _, fs in os.walk(P("assets", "models")):
        paths |= {os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, "/") for f in fs}
    return sorted(paths)


def scan():
    audio, images = [], []
    for p in used_assets():
        if p.startswith(("assets/models/", "assets/collage/")):
            continue
        stem, ext = os.path.splitext(p)
        name = os.path.basename(stem)
        # Opus in Ogg: every Chromium decodes it, while AAC is missing from some phone browsers and WebViews
        if ext == ".wav":
            audio.append({"path": p, "out": stem + ".enc.ogg", "codec": "opus", "bitrate": 160000})
        elif ext in (".m4a", ".mp3"):
            audio.append({"path": p, "out": stem + ".enc.ogg", "codec": "opus", "bitrate": 128000})
        elif ext == ".png":
            images.append({"path": p, "out": stem + ".webp", "max": 1200, "type": "image/webp", "quality": 0.9})
        elif ext in (".jpg", ".jpeg"):
            big = 800 if "/covers/" in p else 1920 if name in FULL else 1400
            images.append({"path": p, "out": stem + ".jpg", "max": big, "type": "image/jpeg", "quality": 0.84 if "/covers/" in p else 0.82})
    os.makedirs(BUILD, exist_ok=True)
    with open(os.path.join(BUILD, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"audio": audio, "images": images}, f, ensure_ascii=False, indent=1)
    print(f"{len(audio)} audio, {len(images)} images -> _build/manifest.json")


def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def safe_json(obj):
    # JSON that can sit inside a <script> element
    return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")


def pack():
    done_path = os.path.join(BUILD, "done.json")
    done = json.load(open(done_path, encoding="utf-8")) if os.path.exists(done_path) else {}
    if not done:
        print("warning: _build/done.json missing — packing uncompressed originals (large)")

    # ---- fonts: cut the Chinese / Cyrillic faces to the characters in use (needs fonttools; see tools/fonts.py)
    r = subprocess.run([sys.executable.replace("pythonw", "python"), os.path.join(ROOT, "tools", "fonts.py")])
    if r.returncode:
        print("warning: tools/fonts.py failed — packing the font subsets already on disk")

    # ---- css: every font inside the file
    css = read("css", "deck.css")
    css = css.replace('url("../assets/fonts/Hahmlet.ttf") format("truetype")', f'url(data:font/ttf;base64,{b64(P("assets", "fonts", "Hahmlet.ttf"))}) format("truetype")')
    css = css.replace('url("../assets/fonts/PretendardVariable.woff2") format("woff2")', f'url(data:font/woff2;base64,{b64(P("assets", "fonts", "PretendardVariable.woff2"))}) format("woff2")')
    for name in ("ZhSerif", "ZhSans", "CyrBlack"):
        css = css.replace(f'url("../assets/fonts/sub/{name}.woff2")', f'url(data:font/woff2;base64,{b64(P("assets", "fonts", "sub", name + ".woff2"))})')
    assert "../assets/" not in css, "a css asset was not inlined"

    # ---- html: pictures are filled in from the bundled assets before the deck starts
    html = read("index.html")
    html = html.replace('<link rel="stylesheet" href="css/deck.css">', f"<style>\n{css}\n</style>")
    html = re.sub(r'src="(assets/[^"]+)"', r'data-asset="\1"', html)

    # ---- assets
    tags, total = [], 0
    for p in used_assets():
        built = done.get(p)
        src = os.path.join(BUILD, *built.split("/")) if built else P(*p.split("/"))
        mime = MIME[os.path.splitext(src)[1].lower()]
        data = b64(src)
        total += len(data)
        tags.append(f'<script type="x/asset" data-path="{p}" data-mime="{mime}">{data}</script>')

    # ---- modules
    mods = {}
    for f in os.listdir(P("js")):
        if f.endswith(".js"):
            mods[f] = read("js", f)
    for f in os.listdir(P("js", "vendor")):
        if f.endswith(".js"):
            mods["vendor/" + f] = read("js", "vendor", f)

    # ---- presenter window, written into a blank window by the deck (system fonts)
    pres = read("presenter.html")
    pres = re.sub(r'\s*@font-face \{[^}]*assets/fonts[^}]*\}', "", pres)

    loader = """<script>
// Unpack: assets to blob: URLs, then the ES modules (each one a blob: URL with its imports rewritten).
(async () => {
  const status = document.getElementById('gate-status');
  const A = {};
  const list = [...document.querySelectorAll('script[type="x/asset"]')];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (status) status.textContent = '… ' + Math.round((i / list.length) * 100) + '%';
    const blob = await (await fetch('data:' + s.dataset.mime + ';base64,' + s.textContent)).blob();
    A[s.dataset.path] = URL.createObjectURL(blob);
    s.remove();
  }
  globalThis.__ASSETS = A;
  document.querySelectorAll('[data-asset]').forEach((el) => { el.src = A[el.dataset.asset]; });
  globalThis.__PRESENTER_HTML = JSON.parse(document.getElementById('presenter').textContent);
  const SRC = JSON.parse(document.getElementById('modules').textContent), urls = {};
  const resolve = (from, rel) => new URL(rel, 'http://x/' + from).pathname.slice(1);
  const load = (name) => urls[name] || (urls[name] = URL.createObjectURL(new Blob([SRC[name].replace(/(\\bfrom\\s*|\\bimport\\s*\\(\\s*)(['"])(\\.{1,2}\\/[^'"]+)\\2/g, (m, k, q, p) => k + q + load(resolve(name, p)) + q)], { type: 'text/javascript' })));
  await import(load('main.js'));
})();
</script>"""

    body_end = '<script type="module" src="js/main.js"></script>'
    assert body_end in html
    html = html.replace(body_end, "\n".join(tags) + "\n"
                        + f'<script type="application/json" id="modules">{safe_json(mods)}</script>\n'
                        + f'<script type="application/json" id="presenter">{safe_json(pres)}</script>\n'
                        + loader)
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, OUT_NAME)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"{out}  {os.path.getsize(out) / 1e6:.1f} MB  (assets {total / 1e6:.1f} MB as base64)")


if __name__ == "__main__":
    {"scan": scan, "pack": pack}[sys.argv[1] if len(sys.argv) > 1 else "pack"]()
