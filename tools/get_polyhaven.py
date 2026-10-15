# Télécharge des matières CC0 Poly Haven (1k et 2k) + un HDRI.
import json, sys, os, urllib.request
op = urllib.request.build_opener(); op.addheaders = [('User-Agent', 'SabotAssetFetcher/1.0')]; urllib.request.install_opener(op)
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
def files(aid): return json.load(urllib.request.urlopen(f'https://api.polyhaven.com/files/{aid}'))
TEX = {'walnut': 'smoked_walnut_veneer', 'leather': 'brown_leather', 'wool': 'caban', 'carpet': 'dirty_carpet'}
for key, aid in TEX.items():
    f = files(aid)
    for res in ('1k', '2k'):
        for kind, label in (('Diffuse', 'diff'), ('nor_gl', 'nor'), ('Rough', 'rough')):
            try:
                url = f[kind][res]['jpg']['url']
            except KeyError:
                continue
            dst = os.path.join(out, f'{key}_{label}_{res}.jpg')
            urllib.request.urlretrieve(url, dst)
            print(dst, os.path.getsize(dst))
h = files('wooden_lounge')
url = h['hdri']['1k']['hdr']['url']
urllib.request.urlretrieve(url, os.path.join(out, 'lounge_1k.hdr'))
print('hdri ok')
