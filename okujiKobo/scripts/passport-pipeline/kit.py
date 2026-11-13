"""Drawing kit. Motifs are drawn in a local box 320 wide x 220 tall, ground at y=216.
Colours are role names: 'i' ink (solid), 'k' knockout (paper), 'a'/'b'/'c' accent roles for covers.
"""
import math

def F(v):
    return f"{round(v, 1):g}"

class D:
    def __init__(self, pal=None):
        self.el = []
        self.pal = pal or {"i": "#000", "k": "#fff", "a": "#000", "b": "#000", "c": "#000", "s": "#000"}

    def c(self, role):
        return self.pal.get(role, role)

    def rect(self, x, y, w, h, r="i", rx=0):
        self.el.append(f"<rect x='{F(x)}' y='{F(y)}' width='{F(w)}' height='{F(h)}' rx='{rx}' fill='{self.c(r)}'/>")

    def poly(self, pts, r="i"):
        p = " ".join(f"{F(x)},{F(y)}" for x, y in pts)
        self.el.append(f"<polygon points='{p}' fill='{self.c(r)}'/>")

    def circ(self, cx, cy, rad, r="i"):
        self.el.append(f"<circle cx='{F(cx)}' cy='{F(cy)}' r='{F(rad)}' fill='{self.c(r)}'/>")

    def ell(self, cx, cy, rx, ry, r="i"):
        self.el.append(f"<ellipse cx='{F(cx)}' cy='{F(cy)}' rx='{F(rx)}' ry='{F(ry)}' fill='{self.c(r)}'/>")

    def path(self, d, r="i"):
        self.el.append(f"<path d='{d}' fill='{self.c(r)}'/>")

    def line(self, pts, w=4, r="i"):
        p = " ".join(f"{F(x)},{F(y)}" for x, y in pts)
        self.el.append(f"<polyline points='{p}' fill='none' stroke='{self.c(r)}' stroke-width='{w}' stroke-linecap='round' stroke-linejoin='round'/>")

    # ---- composite helpers ----
    def ground(self, y=216, h=6, x0=0, x1=320, r="i"):
        self.rect(x0, y - h, x1 - x0, h, r)

    def windows(self, x, y, cols, rows, w, h, gx, gy, r="k", arch=False):
        for i in range(cols):
            for j in range(rows):
                xx, yy = x + i * (w + gx), y + j * (h + gy)
                if arch:
                    self.arch_win(xx, yy, w, h, r)
                else:
                    self.rect(xx, yy, w, h, r)

    def arch_win(self, x, y, w, h, r="k"):
        rad = w / 2
        self.path(f"M{F(x)},{F(y+h)}V{F(y+rad)}A{F(rad)},{F(rad)} 0 0 1 {F(x+w)},{F(y+rad)}V{F(y+h)}Z", r)

    def columns(self, x, y, n, w, h, gap, r="i"):
        for i in range(n):
            self.rect(x + i * (w + gap), y, w, h, r)

    def pediment(self, x, y, w, h, r="i"):
        self.poly([(x, y), (x + w / 2, y - h), (x + w, y)], r)

    def dome(self, cx, base, rad, r="i", lantern=True):
        self.path(f"M{F(cx-rad)},{F(base)}A{F(rad)},{F(rad)} 0 0 1 {F(cx+rad)},{F(base)}Z", r)
        if lantern:
            self.rect(cx - rad * 0.12, base - rad - rad * 0.35, rad * 0.24, rad * 0.4, r)
            self.circ(cx, base - rad - rad * 0.42, rad * 0.09, r)

    def onion(self, cx, base, w, h, r="i"):
        self.path(f"M{F(cx-w*0.32)},{F(base)}C{F(cx-w*0.7)},{F(base-h*0.35)} {F(cx-w*0.5)},{F(base-h*0.75)} {F(cx)},{F(base-h)}"
                  f"C{F(cx+w*0.5)},{F(base-h*0.75)} {F(cx+w*0.7)},{F(base-h*0.35)} {F(cx+w*0.32)},{F(base)}Z", r)

    def spire(self, cx, base, w, h, r="i"):
        self.poly([(cx - w / 2, base), (cx, base - h), (cx + w / 2, base)], r)

    def tree(self, cx, base, rad, r="i"):
        self.rect(cx - rad * 0.12, base - rad * 1.2, rad * 0.24, rad * 1.2, r)
        self.circ(cx, base - rad * 1.55, rad, r)

    def pine(self, cx, base, w, h, r="i"):
        self.rect(cx - w * 0.07, base - h * 0.2, w * 0.14, h * 0.2, r)
        for k in range(3):
            yb = base - h * 0.15 - k * h * 0.25
            ww = w * (1 - k * 0.25)
            self.poly([(cx - ww / 2, yb), (cx, yb - h * 0.45), (cx + ww / 2, yb)], r)

    def waves(self, y, x0=0, x1=320, amp=5, step=24, w=4, r="i", rows=2, gap=12):
        for k in range(rows):
            yy = y + k * gap
            d = f"M{x0},{yy}"
            x = x0
            while x < x1:
                d += f" q{F(step/4)},{-amp} {F(step/2)},0 q{F(step/4)},{amp} {F(step/2)},0"
                x += step
            self.el.append(f"<path d='{d}' fill='none' stroke='{self.c(r)}' stroke-width='{w}' stroke-linecap='round'/>")

    def sun(self, cx, cy, rad, r="i", rays=12, ray=10):
        self.circ(cx, cy, rad, r)
        for k in range(rays):
            a = 2 * math.pi * k / rays
            self.line([(cx + math.cos(a) * (rad + 5), cy + math.sin(a) * (rad + 5)),
                       (cx + math.cos(a) * (rad + 5 + ray), cy + math.sin(a) * (rad + 5 + ray))], 4, r)

    def crown(self, cx, base, w, h, r="i"):
        self.poly([(cx - w / 2, base), (cx - w / 2, base - h), (cx - w / 4, base - h * 0.55), (cx, base - h * 1.1),
                   (cx + w / 4, base - h * 0.55), (cx + w / 2, base - h), (cx + w / 2, base)], r)

    def svg(self):
        return "".join(self.el)
