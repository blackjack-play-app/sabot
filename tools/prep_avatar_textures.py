# Convertit les textures TGA Rocketbox en WebP 2048 et 1024.
import sys, os, glob
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for av in sorted(os.listdir(src)):
    for tga in glob.glob(os.path.join(src, av, 'Textures', '*.tga')):
        base = os.path.splitext(os.path.basename(tga))[0]
        if base.endswith('_specular'):
            continue
        im = Image.open(tga)
        im = im.convert('RGBA' if 'opacity' in base else 'RGB')
        for size in (2048, 1024):
            r = im if im.size[0] == size else im.resize((size, size), Image.LANCZOS)
            q = 88 if size == 2048 else 85
            r.save(os.path.join(out, f'{base}_{size}.webp'), 'WEBP', quality=q, method=6)
        print(av, base)
