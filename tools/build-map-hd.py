"""Join the original 36 tiles at their native resolution for one foreground request."""
from pathlib import Path
from PIL import Image
import hashlib,json
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'assets/maps/hd';out.mkdir(exist_ok=True);manifest=[]
for m in json.loads((ROOT/'assets/maps/previews/provenance.json').read_text()):
 layout=Path(m['path']).stem;canvas=Image.new('RGBA',(1536,1536))
 for row in range(6):
  for col in range(6):
   with Image.open(ROOT/f'assets/maps/{layout}/{col}-{5-row}.webp') as tile:canvas.paste(tile.convert('RGBA'),(col*256,row*256))
 canvas=Image.alpha_composite(Image.new('RGBA',canvas.size,'#252c2a'),canvas).convert('RGB')
 target=out/f'{layout}.webp';canvas.save(target,'WEBP',quality=88,method=4)
 manifest.append({'path':str(target.relative_to(ROOT)),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'size':[1536,1536],'sources':[{'path':source['path'],'sha256':hashlib.sha256((ROOT/source['path']).read_bytes()).hexdigest()} for source in m['sources']]})
(out/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n');print([(Path(m['path']).stem,m['bytes']) for m in manifest])
