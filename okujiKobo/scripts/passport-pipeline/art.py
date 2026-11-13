"""Page backgrounds (612 x 869) and cover wraps (1252 x 869)."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from kit import D
from motifs import M

FONTS = {
    "cond": TTFont("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"),
    "sans": TTFont("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
}

def text(s, cx, base, size, fill, font="cond", track=0.06, max_w=None):
    f = FONTS[font]; gs = f.getGlyphSet(); cm = f.getBestCmap(); upm = f["head"].unitsPerEm
    glyphs = [cm.get(ord(ch), cm[ord("?")]) for ch in s]
    total = sum(gs[g].width for g in glyphs) + track * upm * (len(glyphs) - 1)
    sc = size / upm
    if max_w and total * sc > max_w:
        sc = max_w / total
    x = cx - total * sc / 2
    out = []
    for g in glyphs:
        pen = SVGPathPen(gs); gs[g].draw(pen); d = pen.getCommands()
        if d:
            out.append(f"<path transform='translate({x:.1f},{base:g}) scale({sc:.4f},{-sc:.4f})' d='{d}' fill='#{fill}'/>")
        x += (gs[g].width + track * upm) * sc
    return "".join(out)

def mix(a, b, t):
    a = [int(a[i:i + 2], 16) for i in (0, 2, 4)]; b = [int(b[i:i + 2], 16) for i in (0, 2, 4)]
    return "".join(f"{round(x + (y - x) * t):02X}" for x, y in zip(a, b))

def motif_g(name, x, y, scale, ink, ko):
    d = D({"i": f"#{ink}", "k": f"#{ko}"}); M[name](d)
    return f"<g transform='translate({round(x,1):g},{round(y,1):g}) scale({scale})'>{d.svg()}</g>"

FRAME = ("<path d='M24,14L588,14L598,24L598,845L588,855L24,855L14,845L14,24Z' fill='none' stroke='#{c}' stroke-width='2' stroke-linejoin='round'/>"
         "<path d='M30,20L582,20L592,30L592,839L582,849L30,849L20,839L20,30Z' fill='none' stroke='#{c}' stroke-width='1'/>")

def page_bg(paper, ink, motifs=None):
    tint = mix(ink, paper, 0.55)
    parts = [f"<rect width='612' height='869' fill='#{paper}'/>", FRAME.format(c=ink)]
    parts.append("<clipPath id='inner'><rect x='22' y='22' width='568' height='825'/></clipPath><g clip-path='url(#inner)'>")
    # corner flourishes at the top
    for x in (48, 520):
        parts.append(f"<path d='M{x},48 h44 M{x+22},40 v16' stroke='#{ink}' stroke-width='2' stroke-linecap='round'/>"
                     f"<circle cx='{x+22}' cy='48' r='4' fill='none' stroke='#{ink}' stroke-width='2'/>")
    if motifs:
        # skyline strip of the page's own stops, kept below the lowest stamp box (y 746)
        sc = 0.26
        xs = [44, 182, 330, 468]
        for x, m in zip(xs, motifs):
            parts.append(motif_g(m, x, 812 - 216 * sc, sc, tint, paper))
        parts.append(f"<rect x='24' y='811' width='564' height='3' fill='#{tint}'/>")
    parts.append(f"<rect x='24' y='822' width='564' height='23' fill='#{mix(ink, paper, 0.88)}'/>")
    w = "".join("q12,-6 24,0" for _ in range(24))
    parts.append(f"<path d='M24,834{w}' fill='none' stroke='#{ink}' stroke-width='2' stroke-linecap='round'/>")
    parts.append("</g>")
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 612 869' width='612' height='869'>{''.join(parts)}</svg>"

# ---------------- covers ----------------
# Berlin only here. Munich ("muc") and Stockholm ("sto") cover configs are in the
# project doc and need their motifs added to motifs.py first.
COVERS = {
    "ber": dict(sky="EADFC8", far="CDBFA2", band="1E2A44", cream="F4F1EA", gold="D9A93A",
                front=[("tvtower", 900, 250, 1.6, "6E7C8E"), ("gate", 760, 360, 1.5, "3A4A66")],
                back=[("steelbridge", 60, 270, 1.55, "4A6A6A")], ground="8C7A5E", water="6E8EA0",
                trees="5E7B4C", word="BERLIN"),
}

def cover(code):
    c = COVERS[code]
    p = [f"<rect width='1252' height='869' fill='#{c['band']}'/>"]
    # back panel scene
    p.append(f"<rect x='0' y='0' width='612' height='600' fill='#{c['sky']}'/>")
    p.append(f"<circle cx='470' cy='130' r='54' fill='#{mix(c['gold'], c['sky'], 0.45)}'/>")
    for m, x, y, s, col in c["back"]:
        p.append(motif_g(m, x, y, s, col, c["sky"]))
    if c["water"]:
        p.append(f"<rect x='0' y='560' width='612' height='40' fill='#{c['water']}'/>")
    else:
        p.append(f"<rect x='0' y='560' width='612' height='40' fill='#{c['ground']}'/>")
    p.append(text("okuji", 306, 830, 30, c["cream"], "sans", 0.02))
    # spine
    p.append(f"<rect x='612' y='0' width='28' height='869' fill='#{c['band']}'/>")
    # front panel scene, clipped
    p.append("<clipPath id='fc'><rect x='640' y='0' width='612' height='700'/></clipPath><g clip-path='url(#fc)'>")
    p.append(f"<rect x='640' y='0' width='612' height='700' fill='#{c['sky']}'/>")
    p.append(f"<rect x='640' y='420' width='612' height='280' fill='#{mix(c['far'], c['sky'], 0.4)}'/>")
    p.append(f"<circle cx='1140' cy='150' r='46' fill='#{mix(c['gold'], c['sky'], 0.35)}'/>")
    for m, x, y, s, col in c["front"]:
        p.append(motif_g(m, x, y, s, col, c["sky"]))
    base = 690
    p.append(f"<rect x='640' y='{base-40}' width='612' height='60' fill='#{c['water'] or c['ground']}'/>")
    for x in (676, 1216):
        d = D({"i": f"#{c['trees']}", "k": f"#{c['sky']}"})
        if code == "sto":
            d.pine(0, 0, 70, 150)
        else:
            d.tree(0, 0, 34)
        p.append(f"<g transform='translate({x},{base-40})'>{d.svg()}</g>")
    p.append("</g>")
    p.append(f"<rect x='640' y='700' width='612' height='169' fill='#{c['band']}'/>")
    p.append(text(c["word"], 946, 796, 84, c["cream"], "cond", 0.08, max_w=520))
    p.append(text("A CITY PASSPORT", 946, 842, 22, c["gold"], "cond", 0.22))
    p.append(text("okuji", 1182, 58, 28, c["cream"] if False else c["band"], "sans", 0.02))
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1252 869' width='1252' height='869'>{''.join(p)}</svg>"
