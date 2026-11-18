"""Import pinned community coordinates and original WebP tiles, without resizing."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '268bca49a963d9d8fab31ea169db9097019e3174'
BASE = f'https://raw.githubusercontent.com/NikVince/nightreign-map-router/{COMMIT}/'

def read(path):
    return urlopen(BASE + path, timeout=60).read()

master = {p['id']: p['coordinates'] for p in json.loads(read('public/assets/maps/poi_coordinates_with_ids.json'))}
mapping = read('src/utils/poiLocationMapping.ts').decode()
pairs = re.findall(r'layoutLocation: "([^"]+)", poiId: (\d+)', mapping)
locations = {}
for name, number in pairs:
    locations.setdefault(name, int(number))
spawn_section = mapping.split('const spawnPointMapping:')[1].split('};')[0]
spawns = {name: int(number) for name, number in re.findall(r'"([^"]+)": (\d+)', spawn_section)}
data = json.loads((ROOT / 'data/map-data.json').read_text())
slots = {s['key']: s for r in data['records'] for s in r['slots']}
points = []
for key, slot in slots.items():
    number = 157 if key == 'Minor Base - Minor Erdtree' else locations[slot['location']]
    x, y = master[number]
    points.append(dict(id=key, key=key, category=slot['category'], location=slot['location'], poiId=number, x=(x-507)/1690, y=y/1690))
for name in data['facets']['spawns']:
    number = spawns[name]
    x, y = master[number]
    points.append(dict(id='spawn:'+name, spawn=name, location=name, poiId=number, x=(x-507)/1690, y=y/1690))
layouts = {'Default':'default', 'Crater':'the_crater_shifted', 'Mountaintop':'the_mountaintop_shifted', 'Noklateo':'noklateo_shifted', 'Rotted Woods':'the_rotten_woods_shifted'}
# Points with no content in a terrain are still addressable, but not shown as observed content.
for point in points:
    point['terrains'] = [terrain for terrain in layouts if any(r['mapType']==terrain and (r['spawn']==point['spawn'] if 'spawn' in point else any(s['key']==point['key'] and s['value'] for s in r['slots'])) for r in data['records'])]
assets = []
for terrain, folder in layouts.items():
    for row in range(6):
        for col in range(6):
            filename = f'MENU_MapTile_L0_{row:02}_{col:02}_webp.webp'
            assets.append((f'public/assets/maps/{folder}_map_tiles/{filename}', f'assets/maps/{folder}/{row}-{col}.webp'))
def download(item):
    source, target = item
    payload = read(source)
    path = ROOT / target
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return dict(path=target, sha256=hashlib.sha256(payload).hexdigest())
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    hashes = list(pool.map(download, assets))
result = dict(metadata=dict(source='NikVince/nightreign-map-router', commit=COMMIT, transform=dict(left=507,size=1690), assets=hashes), layouts=layouts, points=points)
(ROOT/'data/map-geometry.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(ROOT/'assets/maps/LICENSE.txt').write_bytes(read('LICENSE'))
print(f'Imported {len(points)} points and {len(assets)} tiles for {len(layouts)} terrains.')
