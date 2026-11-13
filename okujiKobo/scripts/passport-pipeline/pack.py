"""Page background payloads. A page background is stored as paper:ink:tint:tint2:encoded-strip
and rebuilt into the final SVG by page_from_payload (and by _okuji_tmp_page in SQL, byte for byte).

The doc's version of this file also has an LZ packer used for a single-blob load; the
SQL loader does not need it, so it is left out here.
"""
import io
import numpy as np, cairosvg
from PIL import Image
from art import mix
from kit import D
from motifs import M

def strip_enc(motifs):
    from enc import encode, contours_from_mask
    sc = 0.26; xs = [44, 182, 330, 468]
    body = "".join(f"<g transform='translate({x},{812-216*sc:.1f}) scale({sc})'>{(lambda d:(M[m](d), d.svg())[1])(D())}</g>" for x, m in zip(xs, motifs))
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 612 869' width='1224' height='1738'><rect width='612' height='869' fill='#fff'/>{body}</svg>"
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=1224, output_height=1738)
    im = np.array(Image.open(io.BytesIO(png)).convert('L'))
    return encode(contours_from_mask((im < 128).astype(np.uint8) * 255, 0.5, 1.2, 4))

PAGE_TPL = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 612 869' width='612' height='869'><rect width='612' height='869' fill='#{P}'/>"
    "<path d='M24,14L588,14L598,24L598,845L588,855L24,855L14,845L14,24Z' fill='none' stroke='#{I}' stroke-width='2' stroke-linejoin='round'/>"
    "<path d='M30,20L582,20L592,30L592,839L582,849L30,849L20,839L20,30Z' fill='none' stroke='#{I}' stroke-width='1'/>"
    "<path d='M48,48h44M70,40v16M520,48h44M542,40v16' stroke='#{I}' stroke-width='2' stroke-linecap='round'/>"
    "<circle cx='70' cy='48' r='4' fill='none' stroke='#{I}' stroke-width='2'/><circle cx='542' cy='48' r='4' fill='none' stroke='#{I}' stroke-width='2'/>"
    "{STRIP}<rect x='24' y='822' width='564' height='23' fill='#{T2}'/>"
    "<path d='M24,834" + "q12,-6 24,0" * 23 + "' fill='none' stroke='#{I}' stroke-width='2' stroke-linecap='round'/></svg>")
STRIP_TPL = "<path fill='#{T}' fill-rule='evenodd' d='{D}'/><rect x='24' y='811' width='564' height='3' fill='#{T}'/>"

def page_payload(paper, ink, motifs=None):
    return ":".join([paper, ink, mix(ink, paper, 0.55), mix(ink, paper, 0.88), strip_enc(motifs) if motifs else ""])

def page_from_payload(p):
    from enc import decode
    P, I, T, T2, E = p.split(":")
    strip = STRIP_TPL.replace("{T}", T).replace("{D}", decode(E)) if E else ""
    return PAGE_TPL.replace("{P}", P).replace("{I}", I).replace("{T2}", T2).replace("{STRIP}", strip)
