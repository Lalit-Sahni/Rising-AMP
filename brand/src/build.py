"""Build the full RisingAmp vector set."""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geom import VARIANTS, d_of
from lockup import wordmark, metrics

# ---- palette ------------------------------------------------------------
INK    = "#14161C"
PAPER  = "#F4EFEA"
ACCENT = "#2C5A58"

BBOX = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "bbox.json")))
# icon cut measured separately at build time
ICON_BB = dict(x0=69, x1=442, y0=86, y1=443)


def mark_g(name, x, y, h, fill=INK, bb=None):
    """Place a mark so its ink box sits at (x, y) with height h."""
    b = bb or BBOX[name]
    bw, bh = b["x1"] - b["x0"], b["y1"] - b["y0"]
    s = h / bh
    return (f'<g transform="translate({x - b["x0"]*s:.3f} {y - b["y0"]*s:.3f}) '
            f'scale({s:.5f})"><path fill="{fill}" fill-rule="nonzero" '
            f'd="{d_of(name)}"/></g>'), bw * s


def svg_doc(w, h, body, bg=None, title=""):
    t = f"<title>{title}</title>" if title else ""
    r = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" '
            f'width="{w:.2f}" height="{h:.2f}" fill="none">{t}{r}{body}</svg>')


# ---- horizontal lockup --------------------------------------------------
def lockup_h(mark="true", size=100, fill=INK, tracking=-0.012,
             w_light="regular", w_bold="bold"):
    m = metrics(w_light, size)
    cap, desc = m["cap"], m["desc"]
    mh = cap * 1.46                       # mark height relative to cap
    gap = cap * 0.52
    pad = 0

    mg, mw = mark_g(mark, pad, pad, mh, fill)
    over = mh - cap                       # how far the mark rises above the cap
    baseline = pad + mh
    tx = pad + mw + gap
    d, adv = wordmark(size, tx, baseline, tracking,
                      w_light=w_light, w_bold=w_bold)
    body = mg + f'<path fill="{fill}" d="{d}"/>'
    W = tx + adv
    H = baseline + desc * 0.62            # trim to the g descender
    return svg_doc(W, H, body, title="RisingAmp"), W, H


# ---- stacked lockup -----------------------------------------------------
def lockup_v(mark="true", size=100, fill=INK, tracking=-0.012):
    m = metrics("regular", size)
    cap, desc = m["cap"], m["desc"]
    mh = cap * 2.05
    d0, adv = wordmark(size, 0, 0, tracking, w_light="regular")
    mg, mw = mark_g(mark, 0, 0, mh, fill)
    W = max(mw, adv)
    gap = cap * 0.62
    mg, mw = mark_g(mark, (W - mw) / 2, 0, mh, fill)
    baseline = mh + gap + cap
    d, _ = wordmark(size, (W - adv) / 2, baseline, tracking, w_light="regular")
    body = mg + f'<path fill="{fill}" d="{d}"/>'
    return svg_doc(W, baseline + desc * 0.62, body, title="RisingAmp"), W, baseline


# ---- app icon -----------------------------------------------------------
def app_icon(bg, fill, size=512, radius=0.2237, inset=0.225):
    r = size * radius
    h = size * (1 - 2 * inset)
    mg, mw = mark_g("icon", 0, 0, h, fill, bb=ICON_BB)
    x, y = (size - mw) / 2, (size - h) / 2
    body = (f'<rect width="{size}" height="{size}" rx="{r:.2f}" fill="{bg}"/>'
            f'<g transform="translate({x:.2f} {y:.2f})">{mg}</g>')
    return svg_doc(size, size, body, title="RisingAmp")


def favicon(fill=INK, bg=None, size=32):
    h = size * 0.94
    mg, mw = mark_g("icon", 0, 0, h, fill, bb=ICON_BB)
    body = ((f'<rect width="{size}" height="{size}" fill="{bg}"/>' if bg else "")
            + f'<g transform="translate({(size-mw)/2:.3f} {size*0.03:.3f})">{mg}</g>')
    return svg_doc(size, size, body, title="RisingAmp")


def plain_mark(name, fill=INK, size=512, bb=None):
    b = bb or BBOX[name]
    bw, bh = b["x1"] - b["x0"], b["y1"] - b["y0"]
    mg, mw = mark_g(name, 0, 0, size * bh / max(bw, bh), fill, bb=b)
    return svg_doc(mw, size * bh / max(bw, bh), mg, title="RisingAmp")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "dist"
    os.makedirs(out, exist_ok=True)
    W = lambda n, s: open(os.path.join(out, n), "w").write(s)

    for key, fname in [("true", "mark-primary"), ("refined", "alt-refined"),
                       ("structured", "alt-structured"), ("unified", "alt-gamp")]:
        W(f"risingamp-{fname}.svg", plain_mark(key))
    W("risingamp-mark-primary-paper.svg", plain_mark("true", fill=PAPER))
    W("risingamp-mark-primary-accent.svg", plain_mark("true", fill=ACCENT))
    W("risingamp-icon.svg", plain_mark("icon", bb=ICON_BB))

    s, w, h = lockup_h();                 W("risingamp-lockup-horizontal.svg", s)
    s2, _, _ = lockup_h(fill=PAPER);      W("risingamp-lockup-horizontal-paper.svg", s2)
    s3, _, _ = lockup_v();                W("risingamp-lockup-stacked.svg", s3)
    s4, _, _ = lockup_h(w_light="light"); W("risingamp-lockup-horizontal-light.svg", s4)
    from lockup import wordmark as _wm, metrics as _mt
    _m = _mt("regular", 100); _d, _a = _wm(100, 0, _m["cap"], -0.012, w_light="regular")
    W("risingamp-wordmark.svg", svg_doc(_a, _m["cap"] + _m["desc"]*0.62,
        f'<path fill="{INK}" d="{_d}"/>', title="RisingAmp"))

    W("risingamp-appicon-dark.svg",  app_icon(INK, PAPER))
    W("risingamp-appicon-light.svg", app_icon(PAPER, INK))
    W("risingamp-appicon-accent.svg", app_icon(ACCENT, PAPER))
    W("favicon.svg", favicon())
    print("lockup", round(w, 1), "x", round(h, 1), "ratio", round(w / h, 2))
    print("files:", len(os.listdir(out)))
