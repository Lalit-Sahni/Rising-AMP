"""Outline the RisingAmp wordmark to paths, and lock it up with the mark.

Text is converted to outlines so the SVG is font-independent — it renders
identically on a machine that has never heard of Poppins.
"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

FDIR = "/usr/share/fonts/truetype/google-fonts"
FONTS = {"light": "Poppins-Light.ttf", "bold": "Poppins-Bold.ttf",
         "medium": "Poppins-Medium.ttf", "regular": "Poppins-Regular.ttf"}
_cache = {}


def load(weight):
    if weight not in _cache:
        ft = TTFont(os.path.join(FDIR, FONTS[weight]))
        _cache[weight] = (ft, ft.getGlyphSet(), ft["head"].unitsPerEm,
                          ft.getBestCmap())
    return _cache[weight]


def run(text, weight, size, x, y, tracking=0.0):
    """Return (svg_path_d, advance_width). `tracking` is in em."""
    ft, gs, upm, cmap = load(weight)
    s = size / upm
    d, pen_x = [], 0.0
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            continue
        pen = SVGPathPen(gs)
        # y flips: font space is y-up, SVG is y-down
        tp = TransformPen(pen, Transform(s, 0, 0, -s, x + pen_x * s, y))
        gs[gname].draw(tp)
        seg = pen.getCommands()
        if seg:
            d.append(seg)
        pen_x += gs[gname].width + tracking * upm
    return " ".join(d), pen_x * s


def wordmark(size=100, x=0, y=0, tracking=-0.012,
             light="Rising", bold="Amp", w_light="light", w_bold="bold"):
    d1, adv = run(light, w_light, size, x, y, tracking)
    d2, adv2 = run(bold, w_bold, size, x + adv, y, tracking)
    return d1 + " " + d2, adv + adv2


def metrics(weight, size):
    ft, gs, upm, cmap = load(weight)
    os2 = ft["OS/2"]
    return {"cap": os2.sCapHeight * size / upm,
            "x": os2.sxHeight * size / upm,
            "asc": ft["hhea"].ascent * size / upm,
            "desc": -ft["hhea"].descent * size / upm}


if __name__ == "__main__":
    m = metrics("light", 100)
    print({k: round(v, 1) for k, v in m.items()})
    d, w = wordmark(100, 0, 0)
    print("advance", round(w, 1), "chars", len(d))
