"""Fetch pinned factual sources and game tiles, verify CSVs, record provenance.
Requires Pillow. L0 tiles form the 6x6 grid; L1 tiles are a different zoom level.
"""
import concurrent.futures,hashlib,io,json,urllib.request
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
COMMIT='80ea5b3d7492acb15512cac05d6c91dba9f6c82a'
BASE=f'https://raw.githubusercontent.com/xqfinxd/NightreignApp/{COMMIT}/nightreign/assets/'
# The source only supplies underground overlays in these grid cells.
OVERLAYS=[(1, 3), (1, 4), (2, 1), (2, 2), (2, 3), (2, 4), (3, 1), (3, 2), (3, 3), (4, 1), (4, 2), (4, 3)]
hashes=[]
def download(path):
 raw=urllib.request.urlopen(BASE+path,timeout=60).read()
 return raw,{'source':path,'sha256':hashlib.sha256(raw).hexdigest()}
def tile(pair):
 x,y=pair;name=f'MENU_MapTile_L0_{x:02}_{y:02}'
 raw,source=download(f'textures/4/{name}.png');sources=[source]
 surface=Image.open(io.BytesIO(raw)).convert('RGBA');underground=surface.copy()
 if (x,y) in OVERLAYS:
  raw,source=download(f'textures/4/{name}_B1.png');sources.append(source)
  underground.alpha_composite(Image.open(io.BytesIO(raw)).convert('RGBA'))
 for folder,img in [('great_hollow',surface),('great_hollow_under',underground)]:
  path=ROOT/f'assets/maps/{folder}/{x}-{y}.webp';path.parent.mkdir(parents=True,exist_ok=True);img.save(path,lossless=True)
  sources.append({'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 return sources
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for sources in pool.map(tile,[(x,y) for x in range(6) for y in range(6)]):hashes.extend(sources)
for path in sorted((ROOT/'data/sources/nightreign-dlc').glob('*.csv')):
 raw,source=download('datas/'+path.name)
 assert raw.decode('utf-8-sig').replace('\r\n','\n')==path.read_text(encoding='utf-8-sig'),f'Local factual source differs from pinned commit: {path.name}'
 path.write_bytes(raw)
 source['path']=str(path.relative_to(ROOT));hashes.append(source)
(ROOT/'data/map-dlc-provenance.json').write_text(json.dumps({'source':BASE,'commit':COMMIT,'files':hashes},indent=2)+'\n')
print(f'Verified {len(hashes)} input/output hashes.')
