"""Compact vector frame rings (evenodd subpaths) for each stamp shape."""
from shapely.geometry import Polygon

def ring_circle(cx, cy, r1, r2):
    def c(r): return f"M{cx-r:g} {cy}a{r:g} {r:g} 0 1 0 {2*r:g} 0a{r:g} {r:g} 0 1 0 {-2*r:g} 0z"
    return c(r1) + c(r2)

def ring_ellipse(cx, cy, rx1, ry1, rx2, ry2):
    def e(rx, ry): return f"M{cx-rx:g} {cy}a{rx:g} {ry:g} 0 1 0 {2*rx:g} 0a{rx:g} {ry:g} 0 1 0 {-2*rx:g} 0z"
    return e(rx1, ry1) + e(rx2, ry2)

def arch(m):  # outline of the arch at inset m from the original stroke centre line
    x0, x1, yb = 22 + m, 578 - m, 578 - m
    rx, ry = 278 - m, 238 - m
    return f"M{x0:g} {yb:g}V260A{rx:g} {ry:g} 0 0 1 {x1:g} 260V{yb:g}z"

def arch_in(m):
    x0, x1, yb = 52 + m, 548 - m, 548 - m
    rx, ry = 248 - m, 208 - m
    return f"M{x0:g} {yb:g}V262A{rx:g} {ry:g} 0 0 1 {x1:g} 262V{yb:g}z"

def shield(m, base):  # base: (left, top, right, curve) for outer (40,30,560) or inner (70,60,530)
    l, t, r, cy1, cy2, tip, cx2 = base
    l -= m; t -= m; r += m; tip += m * 1.25
    return (f"M{l:g} {t:g}H{r:g}V300C{r:g} {cy1+m*0.6:g} {cx2+m*0.7:g} {cy2+m:g} 300 {tip:g}"
            f"C{600-cx2-m*0.7:g} {cy2+m:g} {l:g} {cy1+m*0.6:g} {l:g} 300z")

def poly_ring(pts, w):
    p = Polygon(pts)
    a = p.buffer(w / 2, join_style=2); b = p.buffer(-w / 2, join_style=2)
    def path(g):
        c = list(g.exterior.coords)[:-1]
        return "M" + "L".join(f"{round(x)} {round(y)}" for x, y in c) + "z"
    return path(a) + path(b)

def frame_path(shape):
    if shape == "circle":
        return ring_circle(300, 300, 293, 271) + ring_circle(300, 300, 252.5, 247.5)
    if shape == "oval":
        return ring_ellipse(300, 300, 297, 261, 275, 239) + ring_ellipse(300, 300, 258.5, 222.5, 253.5, 217.5)
    if shape == "arch":
        return arch(-11) + arch(11) + arch_in(-2.5) + arch_in(2.5)
    if shape == "shield":
        ob = (40, 30, 560, 450, 540, 580, 420); ib = (70, 60, 530, 430, 508, 546, 404)
        return shield(11, ob) + shield(-11, ob) + shield(2.5, ib) + shield(-2.5, ib)
    if shape == "octagon":
        p = [(176, 22), (424, 22), (578, 176), (578, 424), (424, 578), (176, 578), (22, 424), (22, 176)]
        q = [(190, 52), (410, 52), (548, 190), (548, 410), (410, 548), (190, 548), (52, 410), (52, 190)]
        return poly_ring(p, 22) + poly_ring(q, 5)
    p = [(60, 22), (540, 22), (578, 60), (578, 540), (540, 578), (60, 578), (22, 540), (22, 60)]
    q = [(72, 52), (528, 52), (548, 72), (548, 528), (528, 548), (72, 548), (52, 528), (52, 72)]
    return poly_ring(p, 22) + poly_ring(q, 5)
