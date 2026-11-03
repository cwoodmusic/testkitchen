"""Repackage the captured source snapshot after changing the offline UI."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/workspace/scratch/coda-pixel-workshop')
snapshot=json.loads((OUT/'workshop-seed.json').read_text())
fingerprint=hashlib.sha256(json.dumps(snapshot['images'],sort_keys=True).encode())
for file in ['character-renderer.js','pet-companion.js']:fingerprint.update((ROOT/file).read_bytes())
snapshot['baseline']['sourceHash']=fingerprint.hexdigest()
(OUT/'workshop-seed.json').write_text(json.dumps(snapshot,separators=(',',':')))
# The seed file is a build intermediate. All source PNGs and editor code are inline.
styles=['artwork-editor.css', 'tools/art-workshop.css']
scripts=['pixel-selection.js','artwork-editor.js','pixel-editor.js','character-renderer.js','pet-companion.js','character-artwork-adapter.js','tools/art-workshop.js']
html=(ROOT/'tools/art-workshop.html').read_text()
html=html.replace('__STYLES__','\n'.join((ROOT/p).read_text() for p in styles))
html=html.replace('__SEED__',json.dumps(snapshot,separators=(',',':')).replace('<','\\u003c'))
html=html.replace('__SCRIPTS__','\n'.join((ROOT/p).read_text().replace('</script','<\\/script') for p in scripts))
(OUT/'coda-pixel-editor.html').write_text(html)
(OUT/'READ-ME.md').write_text((ROOT/'tools/art-workshop-README.md').read_text())
with zipfile.ZipFile(OUT/'coda-pixel-editor.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for name in ['coda-pixel-editor.html','READ-ME.md']:archive.write(OUT/name,name)
print(json.dumps({'targets':len(snapshot['targets']),'sourceImages':len(snapshot['images']),'characters':len(snapshot['profiles']),'htmlBytes':len(html.encode()),'directory':str(OUT)}))
