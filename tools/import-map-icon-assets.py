"""Download unmodified game map icons from pinned sources, recording hashes."""
from pathlib import Path
import urllib.request,urllib.parse,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'assets/map-icons').mkdir(parents=True,exist_ok=True)
base='https://raw.githubusercontent.com/xqfinxd/NightreignApp/80ea5b3d7492acb15512cac05d6c91dba9f6c82a/nightreign/assets/textures/spots/'
names=['boss','danger boss','encampment','smallcamp','ruins','fort','temple','church','castle','cave','township','sorcerer\'s rise','rare sorcerer\'s rise','village','city1','city2','tower','evergaol','cart','cabin','mark','scale-bearing merchant','star merchant']
manifest=[]
for n in names:
 url=base+urllib.parse.quote(n+'.png');data=urllib.request.urlopen(url).read();name=n.replace(' ','-').replace("'",'')+'.png';(ROOT/'assets/map-icons'/name).write_bytes(data);manifest.append({'file':name,'url':url,'sha256':hashlib.sha256(data).hexdigest()})
url='https://raw.githubusercontent.com/NikVince/nightreign-map-router/268bca49a963d9d8fab31ea169db9097019e3174/public/POI_icons/Spawn_Location.png';data=urllib.request.urlopen(url).read();(ROOT/'assets/map-icons/spawn.png').write_bytes(data);manifest.append({'file':'spawn.png','url':url,'sha256':hashlib.sha256(data).hexdigest()})
(ROOT/'assets/map-icons/provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Downloaded',len(manifest),'original icon assets')
