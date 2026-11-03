"""Build a self-contained editor from the actual game's resolved artwork sources."""
import base64
import hashlib
import importlib.util
import json
import mimetypes
from pathlib import Path
import struct
import subprocess
import sys
from urllib.parse import urlparse
import zipfile
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/workspace/scratch/coda-pixel-workshop')
OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tests'))
spec=importlib.util.spec_from_file_location('art_world',ROOT/'tests/learning-world-browser.py');world=importlib.util.module_from_spec(spec);spec.loader.exec_module(world)
world.WorldBrowserCase.setUpClass();case=world.WorldBrowserCase();case.setUp()
try:
 def capture(route):
  source=(ROOT/'world-artwork-tools.js').read_text()
  source+='\n{const original=window.createCodaWorldArtworkTools;window.createCodaWorldArtworkTools=api=>{window.workshopSourceApi=api;return window.workshopSourceTools=original(api);};}'
  route.fulfill(status=200,content_type='text/javascript',body=source)
 case.context.route('**/world-artwork-tools.js*',capture)
 def characters(route):
  source=(ROOT/'character-artwork-adapter.js').read_text()
  source+='\n{const original=CodaCharacterArtworkAdapter.create;window.workshopCharacterApis=[];CodaCharacterArtworkAdapter.create=api=>{workshopCharacterApis.push(api);return original(api);};}'
  route.fulfill(status=200,content_type='text/javascript',body=source)
 case.context.route('**/character-artwork-adapter.js*',characters)
 case.load();page=case.page
 page.wait_for_function('window.workshopSourceTools&&CodaArcadeQA.environment().ready')
 snapshot=page.evaluate('''async()=>{
  const tools=workshopSourceTools,targets=[],images={},imageId=new Map();
  for(const target of tools.getTargets()){
   const source=await tools.getSource(target.id);if(!source)throw Error('Missing source: '+target.id);
   const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
   if(!width||!height)throw Error('Empty source: '+target.id);
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(source,0,0);
   const data=canvas.toDataURL('image/png');let key=imageId.get(data);if(!key){key='image-'+imageId.size;imageId.set(data,key);images[key]=data;}
   targets.push({...target,width,height,source:key});
  }
  const characters=workshopCharacterApis.slice().sort((a,b)=>(b.getTargets?.().length||0)-(a.getTargets?.().length||0))[0];
  const profiles=Object.fromEntries(CodaPixelEditor.TARGETS.map(id=>[id,characters.getProfile?.(id)||{}]));
  return {targets,images,artwork:tools.getData(),profiles,decor:CodaDecorLibrary.items.map(item=>({...item,path:CodaDecorLibrary.imageURL(item.id).split('?')[0]}))};
 }''')
finally:
 case.tearDown();world.WorldBrowserCase.tearDownClass()
def add_file(id,name,group,file,**extra):
 raw=file.read_bytes();width,height=struct.unpack('>II',raw[16:24]);data='data:image/png;base64,'+base64.b64encode(raw).decode()
 key='file-'+hashlib.sha256(data.encode()).hexdigest()[:18]
 snapshot['images'].setdefault(key,data)
 # Native PNG dimensions are decoded by the offline editor when first opened.
 snapshot['targets'].append({'id':id,'name':name,'group':group,'source':key,'file':str(file.relative_to(ROOT)),'width':width,'height':height,**extra})
for item in snapshot.pop('decor'):
 add_file('library.'+item['id'],item['name'],'Asset library · '+item['category'],ROOT/item['path'],category=item['category'],displayWidth=item['width'],displayHeight=item['height'])
 legacy=ROOT/'assets/decor/v1'/f"{item['id']}.png"
 if legacy.exists() and legacy!=ROOT/item['path']:
  add_file('original.'+item['id'],item['name']+' · original style','Original asset styles',legacy)
add_file('sheet.original-atlas','Original arcade sprite sheet','Source sheets',ROOT/'coda_arcade_game_assets.png')
for sheet in sorted((ROOT/'assets/decor/source').glob('handdrawn-*.png')):
 add_file('sheet.'+sheet.stem,sheet.stem.replace('handdrawn-','').replace('-',' ').title()+' · source sheet','Source sheets',sheet)
snapshot.update(format='CodaPixelWorkshop',version=1,baseline={'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'projectHash':hashlib.sha256((ROOT/'published-world-project.json').read_bytes()).hexdigest()})
(OUT/'workshop-seed.json').write_text(json.dumps(snapshot,separators=(',',':')))
subprocess.check_call([sys.executable,str(ROOT/'tools/package-art-workshop.py'),str(OUT)])
