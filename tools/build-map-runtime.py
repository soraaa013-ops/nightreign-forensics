"""Losslessly intern repeated layout slots and icon facts; keep source snapshots intact."""
from pathlib import Path
import json,hashlib
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
payload={'schema':1,'metadata':base['metadata'],'slots':slots,'keys':keys,'icons':types,'records':records}
path=ROOT/'data/map-runtime.json';path.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(records)} layouts, {len(slots)} unique slots, {path.stat().st_size} bytes')
