"""Build monochrome stamp SVGs: frame + motif (clipped to its zone) + two-line name band, then trace to one evenodd path."""
import io, math, urllib.parse
import numpy as np, cv2, cairosvg
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from kit import D
from motifs import M

FONT = TTFont("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf")
GS = FONT.getGlyphSet(); CMAP = FONT.getBestCmap(); UPM = FONT["head"].unitsPerEm

def text_path(s, x_center, baseline, size, max_w, track=0.04):
    """Return (svg path d, width) for text centred at x_center, scaled to fit max_w."""
    adv = []
    for ch in s:
        g = CMAP.get(ord(ch), CMAP.get(ord("?")))
        adv.append((g, GS[g].width))
    total = sum(a for _, a in adv) + track * UPM * (len(adv) - 1)
    scale = size / UPM
    if total * scale > max_w:
        scale = max_w / total
    w = total * scale
    x = x_center - w / 2
    parts = []
    for g, a in adv:
        pen = SVGPathPen(GS)
        GS[g].draw(pen)
        d = pen.getCommands()
        if d:
            parts.append(f"<path transform='translate({x:.2f},{baseline:.2f}) scale({scale:.5f},{-scale:.5f})' d='{d}'/>")
        x += (a + track * UPM) * scale
    return "".join(parts), w, scale

def frame(shape):
    """Outer frame and inner rule for a 600 stamp. Returns (svg, art_clip, band rect)."""
    if shape == "circle":
        f = "<circle cx='300' cy='300' r='282' fill='none' stroke='#000' stroke-width='22'/><circle cx='300' cy='300' r='250' fill='none' stroke='#000' stroke-width='5'/>"
        art = (116, 90, 320, 220); band = (100, 356, 400, 128)
    elif shape == "oval":
        f = "<ellipse cx='300' cy='300' rx='286' ry='250' fill='none' stroke='#000' stroke-width='22'/><ellipse cx='300' cy='300' rx='256' ry='220' fill='none' stroke='#000' stroke-width='5'/>"
        art = (116, 84, 320, 220); band = (86, 352, 428, 118)
    elif shape == "arch":
        f = ("<path d='M22,578 V260 A278,238 0 0 1 578,260 V578 Z' fill='none' stroke='#000' stroke-width='22' stroke-linejoin='round'/>"
             "<path d='M52,548 V262 A248,208 0 0 1 548,262 V548 Z' fill='none' stroke='#000' stroke-width='5'/>")
        art = (116, 104, 320, 220); band = (70, 370, 460, 150)
    elif shape == "shield":
        f = ("<path d='M40,30 H560 V300 C560,450 420,540 300,580 C180,540 40,450 40,300 Z' fill='none' stroke='#000' stroke-width='22' stroke-linejoin='round'/>"
             "<path d='M70,60 H530 V300 C530,430 404,508 300,546 C196,508 70,430 70,300 Z' fill='none' stroke='#000' stroke-width='5'/>")
        art = (116, 66, 320, 220); band = (96, 334, 408, 118)
    elif shape == "octagon":
        p = [(176, 22), (424, 22), (578, 176), (578, 424), (424, 578), (176, 578), (22, 424), (22, 176)]
        q = [(190, 52), (410, 52), (548, 190), (548, 410), (410, 548), (190, 548), (52, 410), (52, 190)]
        f = ("<polygon points='" + " ".join(f"{a},{b}" for a, b in p) + "' fill='none' stroke='#000' stroke-width='22' stroke-linejoin='round'/>"
             "<polygon points='" + " ".join(f"{a},{b}" for a, b in q) + "' fill='none' stroke='#000' stroke-width='5'/>")
        art = (116, 90, 320, 220); band = (80, 360, 440, 130)
    else:  # rect with notched corners
        f = ("<path d='M60,22 H540 L578,60 V540 L540,578 H60 L22,540 V60 Z' fill='none' stroke='#000' stroke-width='22' stroke-linejoin='round'/>"
             "<path d='M72,52 H528 L548,72 V528 L528,548 H72 L52,528 V72 Z' fill='none' stroke='#000' stroke-width='5'/>")
        art = (116, 92, 320, 220); band = (70, 366, 460, 150)
    return f, art, band

def stamp_svg(shape, motif, line1, line2):
    f, (ax, ay, aw, ah), (bx, by, bw, bh) = frame(shape)
    d = D()
    M[motif](d)
    art = (f"<clipPath id='az'><rect x='0' y='0' width='320' height='220'/></clipPath>"
           f"<g transform='translate({ax},{ay}) scale(1.15)' clip-path='url(#az)'>{d.svg()}</g>")
    # band: rules above and below, two text lines
    cx = 300
    r1 = by + 4; r2 = by + bh - 4
    rules = (f"<rect x='{bx+20}' y='{r1}' width='{bw-40}' height='6' fill='#000'/>"
             f"<rect x='{bx+20}' y='{r2-6}' width='{bw-40}' height='6' fill='#000'/>")
    t1, w1, _ = text_path(line1, cx, by + bh * 0.54, 66, bw - 70)
    t2, w2, _ = text_path(line2, cx, by + bh * 0.86, 40, bw - 120)
    txt = f"<g fill='#000'>{t1}{t2}</g>"
    body = f"<rect width='600' height='600' fill='#fff'/>{f}{art}{rules}{txt}"
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600' width='600' height='600'>{body}</svg>", (ax, ay, aw, ah), (bx, by, bw, bh)

def trace(svg, size=1200):
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size, background_color="white")
    im = np.array(Image.open(io.BytesIO(png)).convert("L"))
    ink = (im < 128).astype(np.uint8) * 255
    contours, hier = cv2.findContours(ink, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    k = 600 / size
    out = []
    for c in contours:
        if cv2.contourArea(c) < 6:
            continue
        a = cv2.approxPolyDP(c, 1.1, True).reshape(-1, 2)
        if len(a) < 3:
            continue
        pts = [(int(round(x * k)), int(round(y * k))) for x, y in a]
        seg = f"M{pts[0][0]} {pts[0][1]}"
        px, py = pts[0]
        for x, y in pts[1:]:
            if (x, y) == (px, py):
                continue
            seg += f"l{x-px} {y-py}"
            px, py = x, y
        out.append(seg + "z")
    d = "".join(out)
    return ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600' width='100%' height='100%'>"
            f"<path fill='currentColor' fill-rule='evenodd' d='{d}'/></svg>"), ink

def clearance_ok(motif, art, band):
    """Text-clearance check: render the motif alone and confirm no ink lands inside the band rect."""
    ax, ay, aw, ah = art; bx, by, bw, bh = band
    d = D(); M[motif](d)
    svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600' width='600' height='600'>"
           f"<clipPath id='az'><rect x='0' y='0' width='320' height='220'/></clipPath>"
           f"<g transform='translate({ax},{ay}) scale(1.15)' clip-path='url(#az)'>{d.svg()}</g></svg>")
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=600, output_height=600)
    a = np.array(Image.open(io.BytesIO(png)))[..., 3]
    return int((a[by - 8: by + bh + 8, bx: bx + bw] > 0).sum()) == 0

def data_url(svg):
    return "data:image/svg+xml;charset=utf-8," + urllib.parse.quote(svg, safe="=:/ ,;'-.()")
