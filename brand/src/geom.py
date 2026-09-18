"""RisingAmp mark — constructed geometry, not traced.

Proportions measured off the source mockup, then rebuilt from maths so every
curve is a true circular arc and the two halves are exactly symmetrical.

Grid: 512 x 512, optical centre cx = 256.
Every shape is emitted as a filled subpath wound CLOCKWISE on screen, so all
subpaths can live in one `d` attribute under fill-rule:nonzero and overlaps
merge instead of punching holes.
"""
import math

CX = 256.0
INK = "#14161A"

# ---- measured proportions (source: mockup, chevron outer height = 1.0) ----
# outer width / outer height          1.348
# chevron stroke, perpendicular       0.112 at apex -> 0.093 at foot
# canopy half-width                   0.292
# canopy crown / tips (from apex)     0.640 / 0.809
# canopy thickness                    0.090
# stem width                          0.079
# stem overshoot past the feet        0.079

# ---- chevron ------------------------------------------------------------
APEX_Y, FOOT_Y = 124.0, 410.0
HALF_W = 202.0
T_APEX, T_FOOT = 36.0, 30.0
R_OUT, R_IN = 15.0, 9.0

FEET_BOTTOM = 419.0          # where the outer foot corners land


def V(x, y): return (float(x), float(y))
def sub(a, b): return (a[0] - b[0], a[1] - b[1])
def add(a, b): return (a[0] + b[0], a[1] + b[1])
def mul(a, s): return (a[0] * s, a[1] * s)
def norm(a):
    m = math.hypot(*a); return (a[0] / m, a[1] / m)


def line_inter(p1, d1, p2, d2):
    den = d1[0] * d2[1] - d1[1] * d2[0]
    t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den
    return add(p1, mul(d1, t))


def fillet(prev_pt, corner, next_pt, r):
    """Circular fillet at `corner`; returns (entry, exit, sweep_flag)."""
    d1 = norm(sub(prev_pt, corner)); d2 = norm(sub(next_pt, corner))
    c = max(-1.0, min(1.0, d1[0] * d2[0] + d1[1] * d2[1]))
    ang = math.acos(c)
    if ang < 1e-6 or abs(ang - math.pi) < 1e-6:
        return corner, corner, 1
    dist = r / math.tan(ang / 2)
    e, x = add(corner, mul(d1, dist)), add(corner, mul(d2, dist))
    cross = d1[0] * d2[1] - d1[1] * d2[0]
    return e, x, (0 if cross > 0 else 1)


def f(n):
    s = f"{n:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def P(p): return f"{f(p[0])} {f(p[1])}"


def arc_r(half_chord, sagitta):
    return (half_chord ** 2 + sagitta ** 2) / (2 * sagitta)


# ---- shapes (all wound clockwise on screen) ------------------------------
def chevron(apex_y=APEX_Y, foot_y=FOOT_Y, half_w=HALF_W,
            t_apex=T_APEX, t_foot=T_FOOT, r_out=R_OUT, r_in=R_IN,
            foot_flick=0.0):
    A, FR, FL = V(CX, apex_y), V(CX + half_w, foot_y), V(CX - half_w, foot_y)
    dR, dL = norm(sub(FR, A)), norm(sub(FL, A))
    nR = (dR[1], -dR[0])            # outer normal, right leg
    nL = (-dL[1], dL[0])            # outer normal, left leg

    RoA, RoF = add(A, mul(nR, t_apex / 2)), add(FR, mul(nR, t_foot / 2))
    RiA, RiF = sub(A, mul(nR, t_apex / 2)), sub(FR, mul(nR, t_foot / 2))
    LoA, LoF = add(A, mul(nL, t_apex / 2)), add(FL, mul(nL, t_foot / 2))
    LiA, LiF = sub(A, mul(nL, t_apex / 2)), sub(FL, mul(nL, t_foot / 2))

    outer_apex = line_inter(RoA, dR, LoA, dL)
    inner_apex = line_inter(RiA, dR, LiA, dL)

    if foot_flick:                  # lift the outer foot corners (rib cue)
        RoF = add(RoF, V(foot_flick * 0.45, -foot_flick))
        LoF = add(LoF, V(-foot_flick * 0.45, -foot_flick))

    oe, ox, _ = fillet(RoF, outer_apex, LoF, r_out)
    ie, ix, _ = fillet(LiF, inner_apex, RiF, r_in)

    # traversed apex L->R, down the right, across, up the inner right,
    # notch, down the inner left, across, up the left  => clockwise on screen
    return (f"M {P(ox)} A {f(r_out)} {f(r_out)} 0 0 1 {P(oe)} "
            f"L {P(RoF)} L {P(RiF)} L {P(ix)} "
            f"A {f(r_in)} {f(r_in)} 0 0 0 {P(ie)} "
            f"L {P(LiF)} L {P(LoF)} Z")


def canopy(cw, tip_y, crown_y, thick, flick=0.0):
    """Crescent: outer arc over the crown, inner arc back under.
    `flick` lifts both tips — the cue that turns a T into an umbrella."""
    ty = tip_y - flick
    lt, rt = V(CX - cw, ty), V(CX + cw, ty)
    ro = arc_r(cw, ty - crown_y)
    ri = arc_r(cw, ty - (crown_y + thick))
    return (f"M {P(lt)} A {f(ro)} {f(ro)} 0 0 1 {P(rt)} "
            f"A {f(ri)} {f(ri)} 0 0 0 {P(lt)} Z")


def canopy_band(cw, crown_y, thick, ro):
    """Constant-thickness arc band: blunt radial ends, so it can be buried in
    the chevron legs without the junction thinning to a knife edge."""
    import math as _m
    cy = crown_y + ro
    ri = ro - thick
    phi = _m.asin(min(1.0, cw / ro))
    ox, oy = CX + ro * _m.sin(phi), cy - ro * _m.cos(phi)
    ix, iy = CX + ri * _m.sin(phi), cy - ri * _m.cos(phi)
    return (f"M {f(2*CX-ox)} {f(oy)} A {f(ro)} {f(ro)} 0 0 1 {f(ox)} {f(oy)} "
            f"L {f(ix)} {f(iy)} A {f(ri)} {f(ri)} 0 0 0 {f(2*CX-ix)} {f(iy)} Z")


def canopy_scalloped(cw, tip_y, crown_y, thick, ribs=3, spike=11, flick=0.0):
    """Crescent whose underside carries rib spikes — the literal gamp read."""
    import math as _m
    ty = tip_y - flick
    ro = arc_r(cw, ty - crown_y)
    ri = arc_r(cw, ty - (crown_y + thick))
    yc_in = crown_y + thick + ri

    def inner_y(x):
        return yc_in - _m.sqrt(max(0.0, ri * ri - (x - CX) ** 2))

    xs = [CX + cw - 2 * cw * k / ribs for k in range(ribs + 1)]   # right -> left
    d = [f"M {f(CX-cw)} {f(ty)} A {f(ro)} {f(ro)} 0 0 1 {f(CX+cw)} {f(ty)}"]
    prev = (xs[0], ty)
    for k in range(1, len(xs)):
        x = xs[k]
        y = ty if k == len(xs) - 1 else inner_y(x) + spike
        r = arc_r(abs(prev[0] - x) / 2, spike * 0.8)
        d.append(f"A {f(r)} {f(r)} 0 0 0 {f(x)} {f(y)}")
        prev = (x, y)
    d.append("Z")
    return " ".join(d)


def leg_centre_x(y):
    """x of the chevron leg centreline at height y (right leg)."""
    return CX + HALF_W * (y - APEX_Y) / (FOOT_Y - APEX_Y)


def fit_band_cw(crown_y, ro):
    """Widest canopy band that terminates exactly on the leg centreline,
    so the junction is buried and nothing pokes out the far side."""
    import math as _m
    lo, hi = 60.0, ro - 1.0
    for _ in range(60):
        cw = (lo + hi) / 2
        phi = _m.asin(min(0.999, cw / ro))
        y_end = crown_y + ro - ro * _m.cos(phi)
        if CX + cw < leg_centre_x(y_end):
            lo = cw
        else:
            hi = cw
    return (lo + hi) / 2


def stem(top_y, bot_y, w_top, w_bot):
    ht, hb = w_top / 2, w_bot / 2
    return (f"M {f(CX-ht)} {f(top_y)} L {f(CX+ht)} {f(top_y)} "
            f"L {f(CX+hb)} {f(bot_y)} L {f(CX-hb)} {f(bot_y)} Z")


def ferrule(tip_y, base_y, w):
    """The spike above the canopy — the strongest small-size umbrella cue."""
    h = w / 2
    return (f"M {f(CX-h)} {f(base_y)} L {f(CX-h)} {f(tip_y+h)} "
            f"A {f(h)} {f(h)} 0 0 1 {f(CX+h)} {f(tip_y+h)} "
            f"L {f(CX+h)} {f(base_y)} Z")


# ---- variants -----------------------------------------------------------
def variant_true():
    """A — the original, made exact. Nothing added, nothing removed."""
    return [
        chevron(),
        canopy(cw=95, tip_y=357, crown_y=302, thick=29),
        stem(top_y=305, bot_y=445, w_top=26, w_bot=26),
    ]


def variant_refined():
    """B — deeper dome, flicked tips, a real ferrule, stem back on the baseline."""
    return [
        chevron(),
        canopy(cw=110, tip_y=372, crown_y=286, thick=28, flick=16),
        stem(top_y=292, bot_y=419, w_top=25, w_bot=28),
        ferrule(tip_y=244, base_y=300, w=22),
    ]


def variant_structured():
    """C — canopy band runs into the legs: a true A crossbar. Survives 16 px."""
    return [
        chevron(),
        canopy_band(cw=fit_band_cw(284, 250), crown_y=284, thick=30, ro=250),
        stem(top_y=288, bot_y=419, w_top=25, w_bot=28),
        ferrule(tip_y=238, base_y=296, w=22),
    ]


def variant_unified():
    """D — scalloped canopy: the gamp made unmistakable."""
    return [
        chevron(),
        canopy_scalloped(cw=114, tip_y=374, crown_y=286, thick=26, ribs=4, spike=9, flick=18),
        stem(top_y=290, bot_y=419, w_top=25, w_bot=28),
        ferrule(tip_y=242, base_y=298, w=22),
    ]


def variant_icon():
    """Icon cut — Mark A's language, redrawn for 16-32 px. Narrower stance,
    heavier stroke, canopy raised and widened until it meets the legs.
    No ferrule: nothing rises above the dome."""
    return [
        chevron(apex_y=112, foot_y=418, half_w=170,
                t_apex=44, t_foot=38, r_out=18, r_in=11),
        canopy(cw=116, tip_y=364, crown_y=272, thick=34),
        stem(top_y=276, bot_y=444, w_top=36, w_bot=36),
    ]


VARIANTS = {
    "true":       ("Mark A · True",       variant_true),
    "refined":    ("Mark B · Refined",    variant_refined),
    "structured": ("Mark C · Structured", variant_structured),
    "unified":    ("Mark D · Unified",    variant_unified),
    "icon":       ("Icon cut",            variant_icon),
}


# ---- output -------------------------------------------------------------
def d_of(name):
    return " ".join(VARIANTS[name][1]())


def svg(name, size=512, fill=INK, bg=None, pad=0):
    d = d_of(name)
    body = f'<rect width="512" height="512" fill="{bg}"/>' if bg else ""
    body += f'<path fill="{fill}" fill-rule="nonzero" d="{d}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            f'width="{size}" height="{size}" role="img">{body}</svg>')


if __name__ == "__main__":
    import os, sys
    out = sys.argv[1] if len(sys.argv) > 1 else "out"
    os.makedirs(out, exist_ok=True)
    for k in VARIANTS:
        open(f"{out}/mark-{k}.svg", "w").write(svg(k))
    print("wrote", len(VARIANTS), "marks to", out)
