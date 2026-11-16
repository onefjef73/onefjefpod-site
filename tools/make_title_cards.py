"""Builds the home page title cards from the two thumbnails (wide and square).

The lettering is lifted out of each thumbnail and set, at a chosen size, on a
full-width map. A dark version is made with the lettering in exactly the same
place, so switching between light and dark never moves the page.

    python3 tools/make_title_cards.py WIDE.jpg SQUARE.jpg [SCALE]

SCALE is how wide the lettering is compared with the original artwork
(1.0 = as drawn, 0.67 = a third smaller). Needs Pillow, numpy,
tools/map-light.png and tools/map-dark.png.
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'static/img')
maps = {t: Image.open(os.path.join(ROOT, f'tools/map-{t}.png')).convert('RGB') for t in ('light', 'dark')}
SCALE = float(sys.argv[3]) if len(sys.argv) > 3 else 0.57

def cover(img, w, h):
    s = max(w / img.width, h / img.height)
    big = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = (big.width - w) // 2; y = (big.height - h) // 2
    return big.crop((x, y, x + w, y + h))

def card(src, name, out_w, top_gap, bottom_room):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(int)
    red = (a[..., 0] - np.maximum(a[..., 1], a[..., 2])) > 45            # the lettering
    rows = np.where(red.sum(axis=1) > im.width * 0.01)[0]; cols = np.where(red.sum(axis=0) > im.height * 0.004)[0]
    pad = round(im.width * 0.012)
    box = (max(cols[0] - pad, 0), max(rows[0] - pad, 0), min(cols[-1] + pad, im.width), min(rows[-1] + pad, im.height))
    letters = Image.fromarray((red * 255).astype('uint8')).crop(box)
    edge = max(3, round(im.width * 0.0032)) | 1                               # reach out to take in the white outline
    with_outline = letters.filter(ImageFilter.MaxFilter(edge * 2 + 1)).filter(ImageFilter.GaussianBlur(edge * 0.35))
    art = im.crop(box)
    # size on the finished card
    k = out_w / im.width * SCALE
    tw, th = round(art.width * k), round(art.height * k)
    out_h = round(out_w * top_gap) + th + round(out_w * bottom_room)
    x, y = (out_w - tw) // 2, round(out_w * top_gap)
    light = cover(maps['light'], out_w, out_h)
    light.paste(art.resize((tw, th), Image.LANCZOS), (x, y), with_outline.resize((tw, th), Image.LANCZOS))
    dark = cover(maps['dark'], out_w, out_h)
    solid = letters.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2)).resize((tw, th), Image.LANCZOS)
    dark.paste(Image.new('RGB', (tw, th), (255, 255, 255)), (x, y), solid)
    light.save(os.path.join(OUT, f'hero-{name}-{out_w}.webp'), quality=74, method=6)
    dark.save(os.path.join(OUT, f'hero-{name}-dark-{out_w}.webp'), quality=74, method=6)
    print(name, (out_w, out_h), 'lettering', (tw, th), f'= {tw / out_w:.0%} of the width')
    return out_w, out_h

w = card(sys.argv[1], 'wide', 2400, top_gap=0.04, bottom_room=0.105)
s = card(sys.argv[2], 'square', 1600, top_gap=0.07, bottom_room=0.2)
print('SIZES', w, s)
