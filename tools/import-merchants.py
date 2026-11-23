"""Build the merchant catalogue from versioned public game facts, without site code."""
import json, hashlib
from pathlib import Path
from opencc import OpenCC
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'data/sources/merchants'
raw=json.loads((source/'catalog.json').read_text())
zh=json.loads((ROOT/'data/merchant-zh.json').read_text());cc=OpenCC('t2s')
AFFINITY={'physical':'','magic':'魔力','fire':'火焰','lightning':'雷电','holy':'神圣','poison':'毒','blood':'血','bleed':'血','frost':'寒冷','cold':'寒冷','rot':'腐败','sleep':'睡眠','madness':'癫火','frenzy':'癫火'}
def translated(kind, id):
 group={'weapon':'weapons','skill':'skills','spell':'spells','effect':'effects','consumable':'consumables'}[kind]
 en=raw[group][id]['name']
 text=cc.convert(zh[kind][en]).replace('HP','血量').replace('FP','专注值')
 return text
items={}
def make_item(row,kind='weapon'):
 if kind=='consumable':
  original=raw['consumables'][row];name=translated('consumable',row);art='';rarity=original['rarity'];prices={m:int(original['price']) for m in ['normal','deep']};effects={m:[] for m in ['normal','deep']}
 else:
  name=translated('weapon',row['weaponId']);prefix='／'.join(AFFINITY[a] for a in row.get('affinity',[]) if AFFINITY[a])
  art=translated(row['art']['kind'],row['art']['id']) if row.get('art') else ''
  variants=row.get('variants')
  prices={m:int(variants[v]['price'] if variants else row['price']) for m,v in [('normal','casual'),('deep','deepOfNight')]}
  rarity=variants['casual']['rarity'] if variants else 'legendary'
  effects={}
  for m,v in [('normal','casual'),('deep','deepOfNight')]:
   facts=variants[v]['passives']+([variants[v]['curse']] if variants[v].get('curse') else []) if variants else [row['passive']]
   effects[m]=[translated('effect',e['id'])+(e.get('magnitude') or '') for e in facts]
 key=hashlib.sha256(json.dumps([kind,row],sort_keys=True).encode()).hexdigest()[:12]
 items[key]={'id':key,'name':name,'kind':kind,'rarity':rarity,'rarities':{m:(rarity if kind=='consumable' or not row.get('variants') else row['variants'][v]['rarity']) for m,v in [('normal','casual'),('deep','deepOfNight')]},'price':prices['normal'],'prices':prices,'skill':art,'affinities':[] if kind=='consumable' else [AFFINITY[a] for a in row.get('affinity',[]) if AFFINITY[a]],'effects':effects}
 return key
sets={s['id']:[make_item(i) for i in s['items']] for s in raw['legendarySets']}
patterns=[]
for p in raw['patterns']:
 result={'id':p['id']}
 for key,shop in [('normal','normal'),('large','township')]:
  group=p[shop];result[key]=[make_item(i,'consumable') for i in group['aromatics']+group['tears']]+[make_item(i) for i in group['items']]
 result['legendary']=sets[p['legendarySetId']]
 result['preNightlord']=[make_item(i,'consumable') for i in p['preNightlordTears']]
 patterns.append(result)
result={'schema':1,'metadata':{'retrieved':'2026-11-23','source':'data/sources/merchants/provenance.json','scope':'随组合变化的武器、盾牌、法杖、圣印记、香药和露滴；不含每局固定货物','patternCount':len(patterns)},'items':items,'patterns':patterns}
(ROOT/'data/merchants.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print(len(patterns),'patterns,',len(items),'stock entries')
