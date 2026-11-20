"""Attach pinned game icon facts to existing slots; never change layout records."""
import csv, json, math
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return [{k.split(':')[0]: v for k, v in r.items()} for r in csv.DictReader((ROOT/'data/sources/nightreign-dlc'/f'{name}.csv').open(encoding='utf-8-sig'))]
def xy(r):
    return ((int(r['gridXNo'])-41+float(r['posX'])/256+.5)/6, 1-(int(r['gridZNo'])-35+float(r['posZ'])/256+.5)/6)
def category(m):
    icon=m['icon']
    if icon in ['fort','encampment','ruins','temple','cave','village','city1','city2']: return 'Major Base'
    if icon in ['church','smallcamp','cart','sorcerer_s_rise','rare_sorcerer_s_rise','cabin','township','star_merchant','scale_bearing_merchant']: return 'Minor Base'
    if icon=='evergaol': return 'Evergaol'
    if icon in ['boss','danger_boss']: return 'Field Boss'
    if m['label']=='主城': return 'Castle'
    if m['label']=='地下室': return 'Arena Boss'
    return None
records={r['id']:r for f in ['map-data','map-dlc'] for r in json.loads((ROOT/'data'/f'{f}.json').read_text())['records']}
points=[p for f in ['map-geometry','map-dlc-geometry'] for p in json.loads((ROOT/'data'/f'{f}.json').read_text())['points'] if p.get('key')]
manual={r['id']:r for r in read('manual_variations')}
spots={(r['map'],r['dlc'],r['attachId']):r for r in read('autogen_spot_list')}
patterns={r['id']:r for r in read('autogen_pattern_list')}
output={};conflicts=[]
for variation in read('autogen_variation_list'):
    pattern=patterns[variation['patternId']]; pid=int(pattern['id']); record=records.get(pid+1 if pid<320 else pid)
    if not record: continue
    meta=manual.get(str(int(variation['variationId'])*10+int(variation['variationType'])))
    spot=spots.get((pattern['map'],pattern['isdlc'],variation['attachId']))
    if not meta or not spot or meta['visible']=='0': continue
    cat=category(meta)
    if not cat: continue
    keys={s['key'] for s in record['slots'] if s['value']}
    eligible=[p for p in points if p['key'] in keys and (p['category']==cat or (cat=='Field Boss' and p['category']=='Rotted Woods'))]
    if not eligible: continue
    x,y=xy(spot)
    point=min(eligible,key=lambda p:math.hypot(p['x']-x,p['y']-y))
    if math.hypot(point['x']-x,point['y']-y) >= .035: continue
    if point.get('tower'): icon='tower'
    elif cat=='Castle': icon='castle'
    elif cat=='Arena Boss': icon='boss'
    else: icon=meta['icon'].replace('_','-').replace('sorcerer-s-rise','sorcerers-rise')
    target=output.setdefault(str(record['id']),{}); previous=target.get(point['key'])
    if previous and previous!=icon:
        # Co-located facts must not silently pick one difficulty.
        conflicts.append([record['id'],point['key'],previous,icon]);target[point['key']]='unknown'
    else: target[point['key']]=icon
# Bound DLC encounters have explicit icon facts too, including white bosses.
for pattern in patterns.values():
    if pattern['map']!='4': continue
    record=records.get(int(pattern['id']))
    if not record: continue
    for bound in read('manual_great_hollow_binding_spots'):
        x,y=xy(bound)
        for point in points:
            if abs(point['x']-x)<.0002 and abs(point['y']-y)<.0002 and any(s['key']==point['key'] and s['value'] for s in record['slots']):
                output.setdefault(str(record['id']),{})[point['key']]=bound['icon'].replace('_','-')
(ROOT/'data/map-icons.json').write_text(json.dumps({'sourceCommit':'80ea5b3d7492acb15512cac05d6c91dba9f6c82a','records':output},ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(output)} records, {sum(map(len,output.values()))} icon facts; {len(conflicts)} ambiguous facts kept neutral')
