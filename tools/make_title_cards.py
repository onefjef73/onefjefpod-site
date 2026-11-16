"""Builds the home page title cards from the two thumbnails (wide and square):
trims the empty map above the wordmark, and makes a matching dark version of
each with the lettering in exactly the same place, so switching between light
and dark never moves the page.

    python3 tools/make_title_cards.py WIDE.jpg SQUARE.jpg
Needs Pillow, numpy and tools/map-dark.png.
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'static/img')
dark_map = Image.open(os.path.join(ROOT, 'tools/map-dark.png')).convert('RGB')

def card(src, name, top_gap, bottom_room, widths):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(int)
    red = (a[..., 0] - np.maximum(a[..., 1], a[..., 2])) > 45       # the lettering
    rows = np.where(red.sum(axis=1) > im.width * 0.01)[0]
    y0, y1 = rows[0], rows[-1]
    top = max(0, int(y0 - top_gap * im.width)); bot = min(im.height, int(y1 + bottom_room * im.width))
    light = im.crop((0, top, im.width, bot))
    mask = Image.fromarray((red[top:bot] * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    scale = max(light.width / dark_map.width, light.height / dark_map.height)
    bg = dark_map.resize((round(dark_map.width * scale), round(dark_map.height * scale)), Image.LANCZOS)
    x = (bg.width - light.width) // 2; y = (bg.height - light.height) // 2
    dark = bg.crop((x, y, x + light.width, y + light.height))
    dark.paste(Image.new('RGB', light.size, (255, 255, 255)), (0, 0), mask)
    for w in widths:
        h = round(w * light.height / light.width)
        light.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, f'hero-{name}-{w}.webp'), quality=72, method=6)
        dark.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, f'hero-{name}-dark-{w}.webp'), quality=72, method=6)
        print(name, w, h, f'text rows {y0}-{y1} of {im.height}')

card(sys.argv[1], 'wide', top_gap=0.045, bottom_room=0.16, widths=[2400])
card(sys.argv[2], 'square', top_gap=0.07, bottom_room=0.24, widths=[1600])
