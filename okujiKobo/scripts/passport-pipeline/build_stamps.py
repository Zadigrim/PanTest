"""Build stamp SVGs for the given cities and a contact sheet per city.
Usage: python build_stamps.py berlin [munich stockholm ...]
"""
import sys, io, json, re, importlib, os
sys.path.insert(0, 'content'); sys.path.insert(0, '.')
import numpy as np, cairosvg
from PIL import Image
from stamps import stamp_svg, clearance_ok
from frames import frame_path
from enc import encode, decode, contours_from_mask

CITIES = sys.argv[1:] or ['berlin']
os.makedirs('generated', exist_ok=True)
res = json.load(open('generated/stamps.json')) if os.path.exists('generated/stamps.json') else {}
for city in CITIES:
    C = importlib.import_module(city); tiles = []
    for s in C.S:
        shape, motif, l1, l2 = s['stamp']
        svg, art, band = stamp_svg(shape, motif, l1, l2)
        assert clearance_ok(motif, art, band), s['slug']
        inner = re.sub(r"<(circle|ellipse|path|polygon)[^>]*stroke-width='(22|5)'[^>]*/>", '', svg)
        png = cairosvg.svg2png(bytestring=inner.encode(), output_width=1200, output_height=1200, background_color='white')
        im = np.array(Image.open(io.BytesIO(png)).convert('L')); mask = (im < 128).astype(np.uint8) * 255
        e = encode(contours_from_mask(mask, 0.5, 1.3))
        full = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600' width='100%' height='100%'>"
                f"<path fill='currentColor' fill-rule='evenodd' d='{frame_path(shape)}{decode(e)}'/></svg>")
        res[s['slug']] = dict(shape=shape, enc=e, svg=full)
        col = full.replace("fill='currentColor'", f"fill='#{s['ink']}'")
        tiles.append(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=col.encode(), output_width=240, output_height=240, background_color='#F4F1EA'))).convert('RGB'))
    sheet = Image.new('RGB', (240 * 7, 240 * 4), 'white')
    for i, t in enumerate(tiles): sheet.paste(t, ((i % 7) * 240, (i // 7) * 240))
    sheet.save(f'generated/{city}_stamps.png')
    print(city, len(tiles), 'stamps')
json.dump(res, open('generated/stamps.json', 'w'))
print('enc avg', sum(len(v['enc']) for v in res.values()) // len(res))
