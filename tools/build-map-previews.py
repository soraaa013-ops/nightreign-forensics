"""Build small, orientation-preserving map previews from the existing tile grid."""
from pathlib import Path
from PIL import Image
import hashlib,json
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'assets/maps/previews';out.mkdir(exist_ok=True)
layouts=['default','the_crater_shifted','the_mountaintop_shifted','noklateo_shifted','the_rotten_woods_shifted','great_hollow','great_hollow_under']
manifest=[]
for layout in layouts:
    canvas=Image.new('RGBA',(1536,1536));sources=[]
    for row in range(6):
        for col in range(6):
            source=ROOT/f'assets/maps/{layout}/{col}-{5-row}.webp'
            with Image.open(source) as tile:canvas.paste(tile.convert('RGBA'),(col*256,row*256))
            sources.append({'path':str(source.relative_to(ROOT)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
    # Match the viewer background before encoding; do not expose RGB hidden under tile alpha.
    canvas=Image.alpha_composite(Image.new('RGBA',canvas.size,'#252c2a'),canvas).convert('RGB')
    target=out/f'{layout}.webp';canvas.resize((512,512),Image.Resampling.LANCZOS).save(target,'WEBP',quality=55,method=6)
    manifest.append({'path':str(target.relative_to(ROOT)),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'sources':sources})
(out/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('7 previews:',sum(m['bytes'] for m in manifest),'bytes total')
