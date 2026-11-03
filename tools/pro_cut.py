# Cuts the engraved string quartet score (the user's PDF, rendered to _raw/score/shots/score_pN.png by headless Chrome
# at 3x) into its bars, so the Прокофьев page can scroll the real notation: staff lines are found as rows of ink,
# five make a staff, four staves a system; bar lines are columns of ink through the whole system. Each bar is cut
# staff by staff (the room between staves, with its dynamics, is left out so the strip stays low), inverted to light
# ink on black, scaled, and packed into one sheet: assets/collage/pro-bars.webp, with the layout in js/pro-bars.js
# (where each bar sits in the sheet, where its music starts after the clef and key, and where in it each note is).
# Run with _raw/venv/Scripts/python.exe.
import json
import os
import sys
import zipfile
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "_raw", "score", "shots")
MXL = os.path.join(ROOT, "_raw", "score", "prokofiev.mxl")
OUT_IMG = os.path.join(ROOT, "assets", "collage", "pro-bars.webp")
OUT_JS = os.path.join(ROOT, "js", "pro-bars.js")
STAFF_PX = 5.8          # one staff space in the finished sheet (px)
PAD = 2.4               # staff spaces kept above and below each staff


def runs(idx):
    out = []
    for i in idx:
        if out and i - out[-1][1] <= 1:
            out[-1][1] = i
        else:
            out.append([i, i])
    return out


def page_rect(a):
    # the page itself: the white sheet inside the viewer's grey
    white = a > 235
    cols = np.where(white.mean(0) > 0.6)[0]
    rows = np.where(white[:, cols[0]: cols[-1]].mean(1) > 0.6)[0]
    return cols[0], cols[-1], rows[0], rows[-1]


def page_systems(a):
    px0, px1, py0, py1 = page_rect(a)
    ink = np.zeros(a.shape, bool)
    ink[py0: py1 + 1, px0 + 4: px1 - 3] = a[py0: py1 + 1, px0 + 4: px1 - 3] < 140
    frac = ink[:, px0: px1].mean(1)
    lines = [(r[0] + r[1]) / 2 for r in runs(np.where(frac > 0.45)[0])]
    # a staff: five lines evenly spaced (any other long line, a hairpin or a bracket, is left out)
    staves, i = [], 0
    while i + 4 < len(lines):
        d = np.diff(lines[i: i + 5])
        if d.max() < 1.25 * d.min() and d.min() > 8:
            staves.append(lines[i: i + 5]); i += 5
        else:
            i += 1
    systems = [staves[i: i + 4] for i in range(0, len(staves) - len(staves) % 4, 4)]
    out = []
    for sy in systems:
        top, bot = int(sy[0][0]), int(sy[3][4])
        sp = float(np.median([np.diff(s).mean() for s in sy]))
        colfrac = ink[top: bot + 1].mean(0)
        bars = [(r[0] + r[1]) / 2 for r in runs(np.where(colfrac > 0.92)[0])]
        # a line that goes on above and below the system is the edge of the page, not a bar line
        above = a[max(0, int(top - 3 * sp)): int(top - sp)]
        bars = [x for x in bars if (above[:, int(x)] < 140).mean() < 0.5]
        # a double bar, or the bracket against the first line, counts once, at its right line
        merged = []
        for b in bars:
            if merged and b - merged[-1] < 1.5 * sp:
                merged[-1] = b
            else:
                merged.append(b)
        out.append({"staves": sy, "space": sp, "bars": merged})
    return out, ink


def music_start(ink, sy, x0, x1):
    # after the clef, key and time signature: the first gap of at least 0.9 staff space in the ink (staff lines left
    # out), past the key signature's width
    sp = sy["space"]
    rows = np.zeros(ink.shape[0], bool)
    for s in sy["staves"]:
        rows[int(s[0] - 0.4 * sp): int(s[4] + 0.4 * sp)] = True
    lines = np.zeros(ink.shape[0], bool)
    for s in sy["staves"]:
        for y in s:
            lines[int(y) - 2: int(y) + 3] = True
    m = rows & ~lines
    col = ink[m][:, int(x0): int(x1)].sum(0)
    gap = 0
    for i in range(int(4 * sp), len(col)):
        gap = gap + 1 if col[i] < 2 else 0
        if gap >= 0.9 * sp:
            return x0 + i - gap + 1 + 0.3 * sp
    return x0


def xml_onsets():
    z = zipfile.ZipFile(MXL)
    name = next(n for n in z.namelist() if n.endswith(".xml") and not n.startswith("META-INF"))
    root = ET.fromstring(z.read(name))
    bars = {}
    for part in root.findall("part"):
        div = 1
        for k, m in enumerate(part.findall("measure")):
            w = float(m.get("width") or 0)
            d = bars.setdefault(k, {"w": w, "on": {}})
            t = 0.0
            last = 0.0
            for el in m:
                if el.tag == "attributes" and el.findtext("divisions"):
                    div = int(el.findtext("divisions"))
                elif el.tag == "backup":
                    t -= int(el.findtext("duration")) / div
                elif el.tag == "forward":
                    t += int(el.findtext("duration")) / div
                elif el.tag == "note":
                    dur = int(el.findtext("duration") or 0) / div
                    chord = el.find("chord") is not None
                    start = last if chord else t
                    x = el.get("default-x")
                    if x is not None and el.find("grace") is None:
                        d["on"].setdefault(round(start, 4), []).append(float(x))
                    if not chord:
                        last = t; t += dur
    # per bar: beat within the bar -> fraction of the music's width (from its first note to the bar line)
    out = []
    for k in sorted(bars):
        b = bars[k]
        xs = {beat: float(np.median(v)) for beat, v in b["on"].items()}
        if not xs:
            out.append([]); continue
        lo, hi = min(xs.values()), b["w"]
        out.append(sorted([beat, max(0.0, min(1.0, (x - lo) / max(1.0, hi - lo)))] for beat, x in xs.items()))
    return out


def main():
    pages = sorted((f for f in os.listdir(SHOTS) if f.startswith("score_p")), key=lambda f: int(f[7:-4]))
    cuts = []
    for f in pages:
        a = np.asarray(Image.open(os.path.join(SHOTS, f)).convert("L"))
        systems, ink = page_systems(a)
        for sy in systems:
            bl = sy["bars"]
            for i in range(len(bl) - 1):
                x0, x1 = bl[i], bl[i + 1]
                start = music_start(ink, sy, x0, x1) if i == 0 else x0 + 0.6 * sy["space"]
                cuts.append({"page": f, "sy": sy, "x0": x0, "x1": x1, "start": start, "first": i == 0})
        print(f, "systems", len(systems), "bars", [len(s["bars"]) - 1 for s in systems])
    print("bars cut:", len(cuts))
    ons = xml_onsets()
    print("bars in the score:", len(ons))
    if "--check" in sys.argv:
        return
    # the sheet: each bar's four staves stacked (staff band = 4 + 2*PAD spaces), music only (clef and key cut off)
    band = int(round((4 + 2 * PAD) * STAFF_PX))
    H = 4 * band
    imgs, meta = [], []
    cache = {}
    for k, c in enumerate(cuts):
        if c["page"] not in cache:
            cache = {c["page"]: Image.open(os.path.join(SHOTS, c["page"])).convert("L")}
        im = cache[c["page"]]
        sy, sp = c["sy"], c["sy"]["space"]
        k_ = STAFF_PX / sp
        w = max(4, int(round((c["x1"] - c["start"]) * k_)))
        out = Image.new("L", (w, H), 0)
        for s_i, s in enumerate(sy["staves"]):
            box = (int(c["start"]), int(s[0] - PAD * sp), int(c["x1"]) + 1, int(s[4] + PAD * sp))
            piece = im.crop(box).resize((w, band), Image.LANCZOS)
            out.paste(Image.fromarray(255 - np.asarray(piece)), (0, s_i * band))
        imgs.append(out)
        meta.append({"w": w, "on": ons[k] if k < len(ons) else []})
    # pack into rows of the sheet
    SW = 4096
    x = y = 0
    rows = []
    for im, m in zip(imgs, meta):
        if x + im.width > SW:
            x = 0; y += H
        m["x"], m["y"] = x, y
        x += im.width
    sheet = Image.new("L", (SW, y + H), 0)
    for im, m in zip(imgs, meta):
        sheet.paste(im, (m["x"], m["y"]))
    sheet.save(OUT_IMG, "WEBP", quality=82)
    with open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write("// Made by tools/pro_cut.py: the bars of the string quartet score, cut from the engraved pages into\n")
        fh.write("// assets/collage/pro-bars.webp. Per bar: x, y, w in the sheet; on: [beat in the bar, fraction of its width].\n")
        fh.write("export const PRO_BARS = " + json.dumps({"h": H, "band": band, "space": STAFF_PX, "bars": [[m["x"], m["y"], m["w"], m["on"]] for m in meta]}, separators=(",", ":")) + ";\n")
    print(OUT_IMG, sheet.size, os.path.getsize(OUT_IMG) // 1024, "KB;", OUT_JS, os.path.getsize(OUT_JS) // 1024, "KB")


if __name__ == "__main__":
    main()
