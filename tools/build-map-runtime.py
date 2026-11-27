"""Losslessly intern repeated layout slots and icon facts; keep source snapshots intact."""
from pathlib import Path
import csv,json
ROOT=Path(__file__).resolve().parents[1]
def read(name):return json.loads((ROOT/'data'/f'{name}.json').read_text())
base=read('map-data');dlc=read('map-dlc');icons=read('map-icons')['records']
slots=[];slot_ids={};keys=[];key_ids={};types=[];type_ids={}
def intern(value,values,index):
 key=json.dumps(value,ensure_ascii=False,separators=(',',':'))
 if key not in index:index[key]=len(values);values.append(value)
 return index[key]
records=[]
for r in base['records']+dlc['records']:
 row={**r,'slots':[intern(s,slots,slot_ids) for s in r['slots']]}
 row['icons']=[intern(k,keys,key_ids)*256+intern(v,types,type_ids) for k,v in icons.get(str(r['id']),{}).items()]
 records.append(row)
assert len(types)<256
# Base catalogue numbers start at one, while base parameter IDs start at zero.
centers = {}
source_dir = ROOT / 'data/sources/nightreign-dlc'
def source_rows(name):
    with (source_dir / f'{name}.csv').open(encoding='utf-8-sig') as source:
        return [{k.split(':')[0]: v for k, v in row.items()} for row in csv.DictReader(source)]

def coordinate(row, prefix=''):
    x = int(row[prefix+'gridXNo']) - 41 + .5 + float(row[prefix+'posX']) / 256
    z = int(row[prefix+'gridZNo']) - 35 + .5 + float(row[prefix+'posZ']) / 256
    point = [round(x / 6, 6), round(1 - z / 6, 6)]
    assert all(0 <= v <= 1 for v in point), point
    return point

patterns = {}
for row in source_rows('autogen_pattern_list'):
    pattern = int(row['id'])
    record_id = pattern + 1 if row['isdlc'] == '0' else pattern
    patterns[row['id']] = (record_id, row['map'], row['isdlc'])
    centers[record_id] = [coordinate(row, f'playArea{day}_') for day in (1, 2)]

# The original catalogue and DLC use different names for the same events.
# Match both the displayed event and that layout's attachment type.
catalog_events = {r['id']: r['specialEvent'] or '' for r in records}
invasions = {'5305': ('卡莉果冰风暴',), '4553': ('格诺斯塔瘟疫', 'Gnoster Plague'),
             '5300': ('格拉迪乌斯入侵',), '4552': ('玛利斯气泡', 'Maris Bubbles'),
             '4555': ('天秤恶魔诅咒', 'Libra Curse'), '4678': ('蒙格特入侵', 'Morgott Invasion')}
spots = {(r['map'], r['dlc'], r['attachId']): r for r in source_rows('autogen_spot_list')}
event_points, point_ids, event_sites = [], {}, {}
for variation in source_rows('autogen_variation_list'):
    kind = invasions.get(variation['variationId'])
    pattern = variation['patternId']
    record_id, terrain, dlc_flag = patterns[pattern]
    if not kind or not catalog_events[record_id].endswith(kind):
        continue
    spot = spots[(terrain, dlc_flag, variation['attachId'])]
    index = intern(coordinate(spot), event_points, point_ids)
    event_sites.setdefault(record_id, set()).add(index)
assert centers.keys() == {r['id'] for r in records}
payload={'schema':1,'circleCenters':centers,'eventPoints':event_points,'eventSites':{k:sorted(v) for k,v in event_sites.items()},'metadata':base['metadata'],'slots':slots,'keys':keys,'icons':types,'records':records}
path=ROOT/'data/map-runtime.json';path.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(records)} layouts, {len(slots)} unique slots, {path.stat().st_size} bytes')
