"""Transform pinned public game parameter facts; retain original base-game IDs."""
import csv,json,math,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(name):
 return [{k.split(':')[0]:v for k,v in r.items()} for r in csv.DictReader((ROOT/'data/sources/nightreign-dlc'/f'{name}.csv').open(encoding='utf-8-sig'))]
def save(path,data): (ROOT/path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
base=json.loads((ROOT/'data/map-data.json').read_text());geo=json.loads((ROOT/'data/map-geometry.json').read_text());dictionary=json.loads((ROOT/'data/zh-CN.json').read_text());zh=dictionary['map']
patterns=read('autogen_pattern_list');variations=read('autogen_variation_list');manual={r['id']:r for r in read('manual_variations')};spots={(r['map'],r['dlc'],r['attachId']):r for r in read('autogen_spot_list')}
by_pattern=collections.defaultdict(list)
for r in variations:by_pattern[int(r['patternId'])].append(r)
terrains=['Default','Mountaintop','Crater','Rotted Woods','Great Hollow','Noklateo'];lords=['Gladius','Adel','Gnoster','Maris','Libra','Fulghor','Caligo','Heolstor','Harmonia','Straghess']
zh.update({'Great Hollow':'大空洞','Harmonia':'安定者们','Straghess':'废弃物之王'})
def xy(r):return ((int(r['gridXNo'])-41+float(r['posX'])/256+.5)/6,1-(int(r['gridZNo'])-35+float(r['posZ'])/256+.5)/6)
def category(m):
 icon=m['icon']
 if icon in ['fort','encampment','ruins','temple','cave','village','city1','city2']:return 'Major Base'
 if icon in ['church','smallcamp','cart','sorcerer_s_rise','rare_sorcerer_s_rise','cabin','township','star_merchant']:return 'Minor Base'
 if icon=='evergaol':return 'Evergaol'
 if icon in ['boss','danger_boss']:return 'Field Boss'
 if m['label']=='主城':return 'Castle'
 if m['label']=='地下室':return 'Arena Boss'
 if icon=='scale_bearing_merchant':return 'Minor Base'
 return None
# Learn stable English value identifiers from overlapping base-game parameter facts.
votes=collections.defaultdict(collections.Counter);mapping={};distances=[]
def nearest(s,cat,terrain):
 x,y=xy(s);eligible=[p for p in geo['points'] if (p.get('category')==cat or (cat=='Field Boss' and p.get('category')=='Rotted Woods')) and terrain in p['terrains']]
 if not eligible:return None
 p=min(eligible,key=lambda p:math.hypot(p['x']-x,p['y']-y));d=math.hypot(p['x']-x,p['y']-y)
 return p if d<.035 else None
for r in patterns[:320]:
 old=base['records'][int(r['id'])]; assert old['id']==int(r['id'])+1
 for v in by_pattern[int(r['id'])]:
  code=str(int(v['variationId'])*10+int(v['variationType']));m=manual.get(code);s=spots.get((r['map'],r['isdlc'],v['attachId']))
  if not m or not s or not category(m):continue
  p=nearest(s,category(m),terrains[int(r['map'])])
  if p:
   value=next((s['value'] for s in old['slots'] if s['key']==p['key']),None)
   if value:votes[code][value]+=1
for code,c in votes.items():
 value,n=c.most_common(1)[0]
 if n/sum(c.values())>=.95:mapping[code]=value
# Matching old starter/night boss IDs preserves existing translations.
spawns={};bosses={}
for r in patterns[:320]:
 old=base['records'][int(r['id'])];spawns[r['starter']]=old['spawn']
 for i in [1,2]:bosses[r[f'bossId{i}']]=old[f'night{i}Boss']
replacements={'洞窟dlc':'洞窟','村落dlc':'村落','大教堂dlc':'大教堂','废墟dlc':'遗迹','魔法塔 dlc':'魔法师塔','血血怪':'血怪','大红熊':'红熊','火焰骑士城':'城寨 - 火焰骑士','神皮城':'城寨 - 神皮','尊腐城':'城寨 - 尊腐骑士','神兽城':'城寨 - 神兽战士','神兽战士(冰)':'神兽战士（冰）','老狮子':'狮子守卫','玛莉卡':'玛莉卡','Boss':'首领','平衡者':'安定者们','睡眠BOSS':'睡眠属性首领（种类未记录）','雷BOSS':'雷属性首领（种类未记录）','拷问官':'拷问官','圣':'圣' }
def clean(s):
 for a,b in replacements.items():s=s.replace(a,b)
 return s.strip()
def term(s):s=clean(s);zh.setdefault(s,s);return s
for r in read('autogen_starter_list'):
 if r['id'] in spawns:continue
 x,y=xy(r);name=term('大空洞 · '+(('西' if x<.4 else '东' if x>.6 else '')+('北' if y<.5 else '南'))+'出生点');spawns[r['id']]=name
 geo['points'].append(dict(id='spawn-'+r['id'],spawn=name,location=name,x=x,y=y,terrains=['Great Hollow']))
for m in manual.values():
 if m['icon']=='danger_boss':bosses.setdefault(m['smallBaseMapId'],term(m['label']))
events={r['id']:term(r['event']) for r in read('manual_events')}
newpoints={};unmapped=collections.Counter();records=[];grids={(r['grid_x'],r['grid_z']):float(r['height']) for r in read('manual_grids')}
def point(s,cat,terrain):
 if terrain!='Great Hollow':
  p=nearest(s,cat,terrain)
  if p:return p
 x,y=xy(s);level='地下' if float(s['height'])<grids.get((str(int(s['gridXNo'])-41),str(int(s['gridZNo'])-35)),-10000) else '地表'
 # Coordinate identity merges interchangeable attachment IDs at the same site.
 key=f'{terrain}:{cat}:{x:.4f}:{y:.4f}:{level}'
 if key not in newpoints:
  direction=('西' if x<.4 else '东' if x>.6 else '')+('北' if y<.4 else '南' if y>.6 else '')
  direction=direction or '中部'
  label=term(f'{zh[terrain]} · {direction}{level}点位 {s["attachId"]}')
  zh[key]=label
  newpoints[key]=dict(id=key,key=key,category=cat,location=label,x=x,y=y,terrains=[terrain],level=level)
 return newpoints[key]
for r in patterns[320:]:
 terrain=terrains[int(r['map'])];slots={}
 for v in by_pattern[int(r['id'])]:
  code=str(int(v['variationId'])*10+int(v['variationType']));m=manual.get(code);s=spots.get((r['map'],r['isdlc'],v['attachId']))
  if not m or not s or not category(m) or m['visible']=='0':
   unmapped[code]+=1;continue
  if terrain=='Great Hollow' and v['attachId'] in ['1111','1112','1113','1114','1115','1116']:
   attach=int(v['attachId']);first=1111 if attach<=1113 else 1114;floor=attach-first
   anchor=spots[(r['map'],r['isdlc'],str(first))];p=point(anchor,'Field Boss',terrain)
   name=term('东南神授塔' if first==1111 else '西北神授塔');p.update(tower=True,location=name);zh[p['key']]=name+' · 第三层'
   value=mapping.get(code) or term(m['label'])
   slot=slots.setdefault(p['key'],dict(key=p['key'],category=p['category'],location=name,value=None,floors=[None,None,None]))
   slot['floors'][floor]=value
   # Preserve the existing third-floor observation key/value for saved links.
   if floor==2:slot['value']=value
   continue
  p=point(s,category(m),terrain)
  value=mapping.get(code) or term(m['label']+(' - '+m['sublabel'] if m['sublabel'] else ''))
  if p['key'] in slots and slots[p['key']]['value']!=value:
   # Co-located bosses remain distinct facts rather than overwriting each other.
   p=point({**s,'posX':str(float(s['posX'])+.01)},category(m),terrain)
  slots[p['key']]=dict(key=p['key'],category=p['category'],location=p['location'],value=value)
 if terrain=='Great Hollow':
  active={v['variationId'] for v in by_pattern[int(r['id'])]}
  for index,b in enumerate(read('manual_great_hollow_binding_spots')):
   if b['binding'] not in active:continue
   p=point({**b,'attachId':f'关联{index+1}'},'Field Boss',terrain)
   slots[p['key']]=dict(key=p['key'],category=p['category'],location=p['location'],value=term(b['label']))
 def circle_region(day):
  prefix = f'playArea{day}_'
  return term(('西' if int(r[prefix+'gridXNo']) < 44 else '东') +
              ('北' if int(r[prefix+'gridZNo']) >= 38 else '南') + '区域')
 record=dict(id=int(r['id']),nightlord=lords[int(r['boss'])],mapType=terrain,spawn=spawns[r['starter']],specialEvent=events.get(r['id'],term('无特殊事件')),night1Boss=bosses.get(r['bossId1'],term('未记录')),night2Boss=bosses.get(r['bossId2'],term('未记录')),extraNightBoss='、'.join(zh.get(bosses.get(r[f'extraBossId{i}'],''),bosses.get(r[f'extraBossId{i}'],'')) for i in [1,2] if r[f'extraBossId{i}']!='-1') or None,night1Circle=circle_region(1),night2Circle=circle_region(2),slots=list(slots.values()))
 if record['extraNightBoss']:term(record['extraNightBoss'])
 records.append(record)
for record in records:
 if record['mapType']=='Great Hollow':
  towers=[s for s in record['slots'] if 'floors' in s]
  assert len(towers)==2 and all(len(t['floors'])==3 and all(t['floors']) for t in towers), record['id']
# Null slots represent absent known sites within that terrain, enabling explicit empty observations.
allpoints=geo['points']+list(newpoints.values())
for r in records:
 have={s['key'] for s in r['slots']}
 for p in allpoints:
  if p.get('key') and r['mapType'] in p['terrains'] and p['key'] not in have:r['slots'].append(dict(key=p['key'],category=p['category'],location=p['location'],value=None))
geo['points']+=list(newpoints.values());geo['layouts']['Great Hollow']='great_hollow'
# Make importer idempotent: extension geometry lives separately.
extra=dict(layouts={'Great Hollow':'great_hollow'},points=[p for p in geo['points'] if p not in json.loads((ROOT/'data/map-geometry.json').read_text())['points']])
meta=dict(source='https://github.com/xqfinxd/NightreignApp',commit='80ea5b3d7492acb15512cac05d6c91dba9f6c82a',records=200,notes='参数快照；未识别的内部组件不作为可选线索。每天的外圈随机，最终圈心由布局决定。点位名称含方位描述，并非官方地名。')
save('data/map-dlc.json',dict(metadata=meta,records=records));save('data/map-dlc-geometry.json',extra);save('data/zh-CN.json',dictionary)
print('Imported',len(records),'records;',len(newpoints),'new sites;',len(mapping),'shared value IDs. Skipped internal/event components:',dict(unmapped))
