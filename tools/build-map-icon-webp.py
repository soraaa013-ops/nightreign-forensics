"""Size map pictograms for 2x UI rendering; retain original source PNGs."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'assets/map-icons/ui';out.mkdir(exist_ok=True)
manifest=[]
for source in sorted((ROOT/'assets/map-icons').glob('*.png')):
 with Image.open(source) as image:
  image=image.convert('RGBA');image.thumbnail((128,128),Image.Resampling.LANCZOS)
  target=out/(source.stem+'.webp');image.save(target,'WEBP',quality=85,method=4)
 manifest.append({'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'path':str(target.relative_to(ROOT)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size})
(out/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(len(manifest),'icons,',sum(m['bytes'] for m in manifest),'bytes')
