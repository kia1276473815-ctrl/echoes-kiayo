# Cuts the birds out of Muybridge's Animal Locomotion frames (1887) and Marey's heron (1886), public domain, from
# _raw/birds/ (listed in manifest.md there), for the birds that cross Act I's pages. Muybridge's are cut with rembg
# (run with _raw/venv/Scripts/python.exe), made grey, trimmed and scaled; Marey's white birds on black are keyed by
# their brightness. Output: assets/collage/birds.webp (one sheet, transparent) and js/birds.js (where each bird is,
# which species, and whether it has to be flipped to fly to the right).
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "_raw", "birds")
OUT_IMG = os.path.join(ROOT, "assets", "collage", "birds.webp")
OUT_JS = os.path.join(ROOT, "js", "birds.js")
H = 200                       # a bird's height in the sheet
FLIP = {"b13", "b14"}       # looked at: these frames face left
SKIP = {"b08", "b11", "b12", "b15", "b16", "b18", "b19", "b20", "b21", "b22", "b24", "b31"}   # grid left in, blurred, cut to pieces, too small


def species(title):
    t = title.lower()
    for k in ("pigeon", "cockatoo", "eagle", "vulture", "hawk", "reiher"):
        if k in t:
            return "heron" if k == "reiher" else k
    return "bird"


def tight(im, pad=6):
    a = np.asarray(im.getchannel("A"))
    ys, xs = np.nonzero(a > 24)
    if not len(xs):
        return im
    return im.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad), min(im.height, ys.max() + pad)))


def main():
    from rembg import remove, new_session
    session = new_session("u2net")
    M = json.load(open(os.path.join(RAW, "manifest.json"), encoding="utf-8"))
    cuts = []
    for o in M:
        if o["id"] in SKIP:
            continue
        im = Image.open(os.path.join(RAW, o["file"])).convert("RGB")
        sp = species(o["title"])
        if sp == "heron":
            g = ImageOps.autocontrast(im.convert("L"), cutoff=1)
            a = np.asarray(g, np.float32)
            alpha = np.clip((a - 90) * 2.2, 0, 255).astype(np.uint8)
            out = Image.merge("LA", (Image.fromarray(np.full_like(alpha, 235)), Image.fromarray(alpha))).convert("RGBA")
        else:
            cut = remove(im, session=session)
            g = ImageOps.autocontrast(im.convert("L"), cutoff=1)
            alpha = cut.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
            out = Image.merge("RGBA", (g, g, g, alpha))
        out = tight(out)
        if o["id"] in FLIP:
            out = ImageOps.mirror(out)
        k = H / out.height if sp != "heron" else 160 / out.height
        out = out.resize((max(1, round(out.width * k)), max(1, round(out.height * k))), Image.LANCZOS)
        cuts.append((o["id"], sp, out))
        print(o["id"], sp, out.size)
    # pack in rows
    SW, x, y, rowh, place = 4096, 0, 0, 0, []
    for cid, sp, im in cuts:
        if x + im.width > SW:
            x = 0; y += rowh; rowh = 0
        place.append([cid, sp, x, y, im.width, im.height])
        x += im.width + 2; rowh = max(rowh, im.height + 2)
    sheet = Image.new("RGBA", (SW, y + rowh), (0, 0, 0, 0))
    for (cid, sp, im), (_, _, px, py, w, h) in zip(cuts, place):
        sheet.paste(im, (px, py))
    sheet.save(OUT_IMG, "WEBP", quality=86, method=6)
    with open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write("// Made by tools/birds.py: Muybridge's birds in flight (Animal Locomotion, 1887) and Marey's heron (1886), cut\n")
        fh.write("// out into assets/collage/birds.webp. Per bird: [id, species, x, y, w, h] in the sheet; all fly to the right.\n")
        fh.write("export const BIRDS = " + json.dumps(place, separators=(",", ":")) + ";\n")
    print(OUT_IMG, sheet.size, os.path.getsize(OUT_IMG) // 1024, "KB")


if __name__ == "__main__":
    main()
