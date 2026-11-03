# Cuts the Prokofiev page's collage out of public-domain pictures (Wikimedia Commons) in _raw/collage/.
# Photos and paintings go through rembg (run with _raw/venv/Scripts/python.exe); the red wedge is keyed by colour,
# the Grandville eyes become feathered fragments, Malevich's square is just cropped. Output: assets/collage/*.webp
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "_raw", "collage")
OUT = os.path.join(ROOT, "assets", "collage")

# name: (source, crop as fractions x0, y0, x1, y1, method, longest side)
CUTS = {
    "prokofiev": ("prokofiev-1918", (0, 0, 1, 1), "rembg", 1100),
    "prokofiev-obit": ("prokofiev-02", (0, 0, 1, 1), "rembg", 700),
    "worker": ("klucis-brigade", (0.44, 0.05, 1.0, 0.74), "notred", 1200),
    "headless": ("atget-mannequin", (0.3, 0.02, 0.78, 1.0), "rembg", 1100),
    "uniforms": ("atget-window", (0.02, 0.24, 0.95, 0.66), "rembg", 1400),
    "square": ("malevich-square", None, "square", 1000),
    # paper stickers pasted over the monuments' faces, like masks: torn-out ovals
    "sticker-cat": ("goya-43", (0.77, 0.66, 0.94, 0.81), "fragment", 380),
    "sticker-owl": ("goya-43", (0.25, 0.42, 0.52, 0.53), "fragment", 380),
    "sticker-mask": ("ensor-masks", (0.29, 0.58, 0.41, 0.72), "fragment", 380),
    "sticker-eye": ("grandville-dream", (0.14, 0.36, 0.33, 0.44), "fragment", 380),
    "sticker-eye2": ("grandville-dream", (0.33, 0.52, 0.48, 0.6), "fragment", 380),
    "sticker-pro": ("prokofiev-02", (0.24, 0.24, 0.76, 0.8), "fragment", 380),
    # Bosch, the Hell wing of The Garden of Earthly Delights: each thing once
    "bosch-ears": ("bosch-hell", (0.17, 0.243, 0.51, 0.326), "rembg", 900),
    "bosch-treeman": ("bosch-hell", (0.22, 0.345, 0.69, 0.537), "rembg", 1000),
    "bosch-bagpipe": ("bosch-hell", (0.41, 0.245, 0.72, 0.362), "rembg", 700),
    "bosch-hurdy": ("bosch-music", (0.53, 0.15, 0.83, 0.9), "grow", 1100, [(0.3, 0.3), (0.5, 0.45), (0.75, 0.3), (0.5, 0.8), (0.45, 0.95)], 24),
    "bosch-pignun": ("bosch-music", (0.42, 0.62, 0.61, 0.92), "rembg", 700),
    "bosch-drum": ("bosch-music", (0.79, 0.74, 1.0, 0.9), "grow", 600, [(0.35, 0.6), (0.7, 0.4), (0.55, 0.15), (0.8, 0.75)], 26),
}


def src(name):
    d = os.path.join(RAW, name)
    return Image.open(os.path.join(d, os.listdir(d)[0])).convert("RGB")


def crop(im, box):
    w, h = im.size
    return im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h))) if box else im


def fit(im, side):
    k = min(1, side / max(im.size))
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS) if k < 1 else im


def tight(im):
    a = np.array(im.getchannel("A"))
    ys, xs = np.nonzero(a > 12)
    if not len(xs):
        return im
    p = 6
    return im.crop((max(0, xs.min() - p), max(0, ys.min() - p), min(im.width, xs.max() + p), min(im.height, ys.max() + p)))


def main(only):
    os.makedirs(OUT, exist_ok=True)
    session = None
    for name, (s, box, how, side, *extra) in CUTS.items():
        seeds, tol = extra if extra else (None, None)
        if only and name not in only:
            continue
        im = crop(src(s), box)
        if how == "rembg":
            from rembg import new_session, remove
            session = session or new_session("isnet-general-use")
            out = remove(im, session=session, post_process_mask=True)
        elif how == "grow":
            # region growing for Bosch's painted objects, which rembg keeps merging with the crowd around them:
            # every pixel near (in Lab) the colour at a seed and connected to it, small holes filled, edge softened
            from scipy import ndimage
            from skimage import color, morphology
            lab = color.rgb2lab(np.asarray(im) / 255.0)
            h, w = lab.shape[:2]
            keep = np.zeros((h, w), bool)
            for fx, fy in seeds:
                y, x = int(fy * (h - 1)), int(fx * (w - 1))
                ref = lab[max(0, y - 3):y + 4, max(0, x - 3):x + 4].reshape(-1, 3).mean(axis=0)
                near = np.linalg.norm(lab - ref, axis=2) < tol
                lbl, _ = ndimage.label(near)
                if lbl[y, x]:
                    keep |= lbl == lbl[y, x]
            keep = morphology.closing(keep, morphology.disk(3))
            keep = morphology.remove_small_holes(keep, max_size=int(keep.sum() * 0.04) + 64)
            keep = morphology.opening(keep, morphology.disk(2))
            alpha = ndimage.gaussian_filter(keep.astype(np.float32), 1.0)
            out = im.convert("RGBA")
            out.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)))
        elif how == "red":
            a = np.asarray(im).astype(np.float32)
            red = np.clip((a[..., 0] - np.maximum(a[..., 1], a[..., 2]) - 40) / 60, 0, 1)
            out = im.convert("RGBA")
            out.putalpha(Image.fromarray((red * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)))
        elif how == "notred":
            # a photograph pasted on a red ground (Klutsis): keep everything that is not the red
            a = np.asarray(im).astype(np.float32)
            red = np.clip((a[..., 0] - np.maximum(a[..., 1], a[..., 2]) - 45) / 50, 0, 1)
            light = np.clip((a.min(axis=2) - 205) / 30, 0, 1)
            keep = (1 - np.maximum(red, light)) ** 1.5
            out = im.convert("RGBA")
            out.putalpha(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5)))
        elif how == "fragment":
            # a torn-out piece of the drawing: a feathered oval, the ink kept, the paper let go a little
            w, h = im.size
            yy, xx = np.mgrid[0:h, 0:w]
            r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
            noise = np.asarray(Image.effect_noise((w, h), 60).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
            edge = np.clip((1.0 - r + (noise - 0.5) * 0.35) / 0.28, 0, 1)
            out = im.convert("RGBA")
            out.putalpha(Image.fromarray((edge * 255).astype(np.uint8)))
        else:  # the square: find the black field and keep just it, cracks and all
            g = np.asarray(im.convert("L")).astype(np.float32)
            ys, xs = np.nonzero(g < 60)
            out = im.crop((int(np.percentile(xs, 1)), int(np.percentile(ys, 1)), int(np.percentile(xs, 99)), int(np.percentile(ys, 99)))).convert("RGBA")
        out = fit(tight(out), side)
        path = os.path.join(OUT, name + ".webp")
        out.save(path, "WEBP", quality=86, method=6)
        print(f"{name:16} {out.size[0]}x{out.size[1]}  {os.path.getsize(path) / 1e3:.0f} KB")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
