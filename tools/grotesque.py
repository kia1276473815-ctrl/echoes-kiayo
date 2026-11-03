# Packs the grotesque wall's pictures (Prokofiev page, after 3:41) into one texture atlas.
# Sources: _raw/grotesque/ (public-domain paintings and prints from Wikimedia Commons, and Dalí's low-resolution
# pictures from English Wikipedia, listed in manifest.md there). Every picture gives one square cut where it is busiest;
# the most crowded ones (Bosch, Bruegel, the hells) give a few more close-ups, until all 16 x 16 cells are full.
# Run with _raw/venv/Scripts/python.exe. Output: assets/collage/grotesque.webp (4096 x 4096, cells of 256 px, filled in random order).
import os
import random

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "_raw", "grotesque")
OUT = os.path.join(ROOT, "assets", "collage", "grotesque.webp")
GRID, CELL = 16, 256
ONCE = {"g125.jpg"}
SKIP = {"g124.jpg", "g125.jpg"}   # plates of numbered figures


def trim(im):
    # prints and drawings come on a sheet of paper, paintings sometimes in a frame on a wall: keep the inside
    g = np.asarray(im.convert("L").resize((256, max(8, round(256 * im.height / im.width)))), np.float32)
    edge = np.concatenate([g[:4].ravel(), g[-4:].ravel(), g[:, :4].ravel(), g[:, -4:].ravel()])
    m = np.abs(g - np.median(edge)) > 28
    rows, cols = np.nonzero(m.mean(1) > 0.12)[0], np.nonzero(m.mean(0) > 0.12)[0]
    if len(rows) < 8 or len(cols) < 8:
        return im
    k = im.width / 256
    box = (int(cols[0] * k), int(rows[0] * k), int((cols[-1] + 1) * k), int((rows[-1] + 1) * k))
    return im.crop(box) if min(box[2] - box[0], box[3] - box[1]) >= 220 else im


def busy(im):
    # how much is going on at each point: edges plus colour, smoothed, on a small copy (longest side 256)
    k = 256 / max(im.size)
    s = im.resize((max(8, round(im.width * k)), max(8, round(im.height * k))), Image.BILINEAR)
    g = np.asarray(s.convert("L").filter(ImageFilter.FIND_EDGES), np.float32)
    hsv = np.asarray(s.convert("HSV"), np.float32)
    m = g + 0.25 * hsv[..., 1] * (hsv[..., 2] / 255)
    m[:3], m[-3:], m[:, :3], m[:, -3:] = 0, 0, 0, 0     # scan edges and frames
    return m, k


def best(m, side, taken, centre_bias):
    # the square window of this side (in map pixels) with the most going on, away from the cuts already taken
    ii = np.pad(m.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    h, w = m.shape
    s = int(side)
    if s >= min(h, w):
        s = min(h, w) - 1
    S = ii[s:, s:] - ii[:-s, s:] - ii[s:, :-s] + ii[:-s, :-s]
    ys, xs = np.mgrid[0:S.shape[0], 0:S.shape[1]]
    cy, cx = (h - s) / 2, (w - s) / 2
    d = np.hypot((ys - cy) / max(1, h), (xs - cx) / max(1, w))
    score = S / (S.max() + 1e-6) - centre_bias * d
    for (x0, y0, ss) in taken:
        ox = np.clip(np.minimum(xs + s, x0 + ss) - np.maximum(xs, x0), 0, None)
        oy = np.clip(np.minimum(ys + s, y0 + ss) - np.maximum(ys, y0), 0, None)
        score = np.where(ox * oy > 0.15 * s * s, -9, score)
    y, x = np.unravel_index(np.argmax(score), score.shape)
    return int(x), int(y), s, float(S[y, x] / (s * s))


def flat(s, x, y, n):
    k = s["k"]
    g = np.asarray(s["im"].crop((int(x / k), int(y / k), int((x + n) / k), int((y + n) / k))).convert("L"), np.float32)
    return g.std() < 22 or (g > 228).mean() > 0.55     # bare, or mostly paper


def main():
    files = sorted(f for f in os.listdir(RAW) if f.lower().endswith((".jpg", ".jpeg", ".png")) and f not in SKIP)
    srcs = []
    for f in files:
        im = trim(Image.open(os.path.join(RAW, f)).convert("RGB"))
        m, k = busy(im)
        # numbered plates (Haeckel) give close-ups of their numbers: those only once
        srcs.append({"f": f, "im": im, "m": m, "k": k, "taken": [], "once": f in ONCE, "detail": float(m.mean()) * im.width * im.height / 1e6})
    cuts = []
    for s in srcs:
        side = min(s["m"].shape) * 0.92
        x, y, n, _ = best(s["m"], side, s["taken"], 0.6)
        s["taken"].append((x, y, n))
        if not flat(s, x, y, n):
            cuts.append((s, x, y, n))
    # close-ups from the most crowded pictures: the biggest share to the busiest, never more than six from one
    extra = GRID * GRID - len(cuts)
    rich = sorted((s for s in srcs if min(s["im"].size) >= 700 and not s["once"]), key=lambda s: -s["detail"])
    while extra > 0:
        for s in rich:
            if extra <= 0:
                break
            if len(s["taken"]) >= 6:
                continue
            side = min(s["m"].shape) * random.Random(s["f"] + str(len(s["taken"]))).uniform(0.26, 0.42)
            x, y, n, v = best(s["m"], side, s["taken"], 0.15)
            s["taken"].append((x, y, n))
            # nothing much there (sky, a bare wall, paper): try elsewhere
            if v < 0.7 * s["m"].mean() or flat(s, x, y, n):
                continue
            cuts.append((s, x, y, n))
            extra -= 1
    random.Random(1953).shuffle(cuts)
    atlas = Image.new("RGB", (GRID * CELL, GRID * CELL))
    for i, (s, x, y, n) in enumerate(cuts[: GRID * GRID]):
        k = s["k"]
        W, H = s["im"].size
        box = (x / k, y / k, min(W, (x + n) / k), min(H, (y + n) / k))
        c = s["im"].resize((CELL, CELL), Image.LANCZOS, box=box)
        c = ImageOps.autocontrast(c, cutoff=0.5)
        atlas.paste(c, ((i % GRID) * CELL, (i // GRID) * CELL))
    atlas.save(OUT, "WEBP", quality=74, method=6)
    print(f"{len(files)} pictures, {len(cuts)} cuts -> {OUT} {os.path.getsize(OUT) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
