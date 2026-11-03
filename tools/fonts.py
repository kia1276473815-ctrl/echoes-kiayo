# Cuts the Chinese and Cyrillic fonts down to the characters the deck actually uses, so the packaged file
# carries them and looks the same on any computer or phone. Needs fonttools + brotli (pip install fonttools brotli).
# Run again whenever the Chinese text changes; tools/build.py pack calls it automatically.
import os
import re

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = [os.path.join(ROOT, "index.html"), os.path.join(ROOT, "presenter.html")] + [
    os.path.join(ROOT, "js", f) for f in os.listdir(os.path.join(ROOT, "js")) if f.endswith(".js")]
OUT = os.path.join(ROOT, "assets", "fonts", "sub")

CJK = re.compile("[⺀-⿟　-〿㐀-䶿一-鿿豈-﫿︰-﹏＀-￯]")
CYR = re.compile("[Ѐ-ӿ]")


def used_text():
    text = "".join(open(p, encoding="utf-8").read() for p in SRC)
    return set(CJK.findall(text)), set(CYR.findall(text))


def cut(src, dst, chars):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.hinting = False
    opts.name_IDs = ["*"]
    font = TTFont(src)
    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted({ord(c) for c in chars}))
    s.subset(font)
    font.flavor = "woff2"
    font.save(dst)
    print(f"{os.path.basename(dst)}  {len(chars)} chars  {os.path.getsize(dst) / 1e3:.0f} KB")


def main():
    os.makedirs(OUT, exist_ok=True)
    cjk, cyr = used_text()
    fonts = os.path.join(ROOT, "assets", "fonts")
    # Chinese serif and sans also carry the Cyrillic letters, so Прокофьев looks the same everywhere
    cut(os.path.join(fonts, "NotoSerifSC-VF.ttf"), os.path.join(OUT, "ZhSerif.woff2"), cjk | cyr)
    cut(os.path.join(fonts, "NotoSansSC-VF.ttf"), os.path.join(OUT, "ZhSans.woff2"), cjk | cyr)
    # a black sans for the Soviet title and the rubber stamps: Cyrillic, digits and a little punctuation
    cut(os.path.join(fonts, "NotoSansSC-VF.ttf"), os.path.join(OUT, "CyrBlack.woff2"), cyr | set("0123456789 .·,:-IVX"))


if __name__ == "__main__":
    main()
