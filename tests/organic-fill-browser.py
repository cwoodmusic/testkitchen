"""A bucket removes old blended colors without breaking organic shore geometry."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urljoin
import json
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
entry = (ROOT/'town/builder/app.mjs').read_text()
def dependency(needle):
    line = next(line for line in entry.splitlines() if needle in line and line.startswith('import'))
    return urljoin('/town/builder/app.mjs', line.split("'")[1])
deps = {name: dependency(needle) for name, needle in {
    'model':'../world/model.mjs', 'runtime':'../world/runtime.mjs',
    'organic':'./organic-edges.mjs', 'land':'./land-fill.mjs'}.items()}
for name, filename, needle in [
    ('roundRender', 'town/world/terrain-render.mjs', './round-render.mjs'),
    ('ground', 'town/world/round-render.mjs', './ground-render.mjs'),
    ('mask', 'town/world/round-render.mjs', './organic-mask.mjs')]:
    line=next(line for line in (ROOT/filename).read_text().splitlines() if needle in line and line.startswith('import'))
    deps[name]=urljoin('/'+filename,line.split("'")[1])

HTML = '''<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#172f31;color:#f3e1ba;font:18px system-ui}.row{display:flex}.panel{width:600px}h2{font-size:18px;font-weight:500;margin:0;height:36px;display:grid;place-items:center}canvas{display:block;image-rendering:pixelated}.wide h2{height:36px}
</style><div class="row"><div class="panel"><h2>Organic grass / sand edge</h2><canvas id="before" width="600" height="450"></canvas></div><div class="panel"><h2>Sand filled with dirt · grass boundary preserved</h2><canvas id="one" width="600" height="450"></canvas></div><div class="panel"><h2>Both sides filled · no old grass ribbon</h2><canvas id="both" width="600" height="450"></canvas></div></div><div class="wide"><h2>Raised organic bank · lower floor filled, heights preserved</h2><canvas id="cliff" width="1800" height="420"></canvas></div><script type="module">
const deps=DEPS;
const [{blank,parseProject,height,surfaceAt},{render},{planOrganicEdges},{planLandFill}]=await Promise.all([import(deps.model),import(deps.runtime),import(deps.organic),import(deps.land)]);
const source=await(await fetch(deps.organic)).text(),paintPath=new URL(source.split(String.fromCharCode(10)).find(l=>l.includes('ground-paint.mjs')).split("'")[1],location.origin+deps.organic).href;
const [{readPaint,encodePaint},{drawRoundUnder},{drawGround},{encodeMask}]=await Promise.all([import(paintPath),import(deps.roundRender),import(deps.ground),import(deps.mask)]),apply=(d,p)=>Object.assign(d.cells,Object.fromEntries(p.edits));
const d=blank();for(let y=85;y<108;y++)for(let x=112;x<146;x++){
 const a={surface:x<128?'sand':'grass',level:0};d.cells[`${x},${y}`]=a;
 if(x===127||x===128){const weights=new Uint8Array(512);for(let i=0;i<256;i++){weights[i*2]=x===127?200:55;weights[i*2+1]=255-weights[i*2];}a.paint=encodePaint([{surface:'sand'},{surface:'grass'}],weights);}
}
for(let y=5904;y<=6384;y+=24)apply(d,planOrganicEdges(d,{x:8192,y},{size:192,strength:.55}));
const before=structuredClone(d);apply(d,planLandFill(d,{x:8120,y:6144},{surface:'dirt'}));const one=structuredClone(d);
apply(d,planLandFill(d,{x:8280,y:6144},{surface:'dirt'}));parseProject(JSON.stringify(d),new Set());
const cam={x:8192,y:6144,zoom:.7},draw=(id,doc,camera=cam)=>{const cv=document.getElementById(id),c=cv.getContext('2d');c.imageSmoothingEnabled=false;render(c,doc,camera,cv.width,cv.height,{});return c.getImageData(0,0,cv.width,cv.height).data;};
draw('before',before);draw('one',one);const actual=draw('both',d);
const expected=blank();for(const [k,a]of Object.entries(d.cells))expected.cells[k]={surface:'dirt',level:a.level};
const test=document.createElement('canvas');test.width=600;test.height=450;const g=test.getContext('2d');g.imageSmoothingEnabled=false;render(g,expected,cam,600,450,{});const wanted=g.getImageData(0,0,600,450).data;
let differingPixels=0;for(let i=0;i<actual.length;i+=4)if(actual[i]!==wanted[i]||actual[i+1]!==wanted[i+1]||actual[i+2]!==wanted[i+2]||actual[i+3]!==wanted[i+3])differingPixels++;
const cliff=blank();for(let y=83;y<108;y++)for(let x=111;x<147;x++)cliff.cells[`${x},${y}`]={surface:'grass',level:y<96?3:1};
for(let x=7600;x<8900;x+=24)apply(cliff,planOrganicEdges(cliff,{x,y:6144},{size:192,strength:.55}));
const samples=[];for(let y=5954;y<6320;y+=4)for(let x=7554;x<8920;x+=4)samples.push({x,y,z:height(cliff,x,y),surface:surfaceAt(cliff,x,y)});
apply(cliff,planLandFill(cliff,{x:8192,y:6304},{surface:'dirt'}));let heightChanges=0,highChanges=0,lowerMisses=0;
for(const p of samples){if(height(cliff,p.x,p.y)!==p.z)heightChanges++;if(p.z===144&&surfaceAt(cliff,p.x,p.y)!==p.surface)highChanges++;if(p.z===48&&surfaceAt(cliff,p.x,p.y)!=='dirt')lowerMisses++;}
parseProject(JSON.stringify(cliff),new Set());draw('cliff',cliff,{x:8192,y:6100,zoom:.85});
// A lower floor may paint only its cutout, never the complete rectangle behind
// a neighboring cliff. Different cutouts must keep their own floor materials.
const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#ff00ff';c.fillRect(0,0,64,64);c.translate(-640,-640);
const floors=blank(),curve=(predicate,surface)=>({kind:'surface',corner:'nw',cx:704,cy:704,r:64,underX:10,underY:10,under:{surface,level:0},mask:encodeMask(Uint8Array.from({length:256},(_,i)=>predicate(i%16)?0:1))});
floors.cells['10,10']={surface:'grass',level:0,curves:[curve(x=>x<4,'dirt'),curve(x=>x>=12,'wood')]};drawRoundUnder(c,floors,10,10);
const color=(g,x,y)=>[...g.getImageData(x,y,1,1).data],protectedUnder=color(c,32,32),leftFloor=color(c,8,32),rightFloor=color(c,56,32);
const donor=document.createElement('canvas');donor.width=donor.height=64;const dc=donor.getContext('2d');dc.imageSmoothingEnabled=false;drawGround(dc,floors,{surface:'dirt',level:0},10,10,0,0);const expectedLeft=color(dc,8,32);drawGround(dc,floors,{surface:'wood',level:0},10,10,0,0);const expectedRight=color(dc,56,32);
window.result={differingPixels,heightChanges,highChanges,lowerMisses,curvesBefore:Object.values(before.cells).filter(a=>a.curves).length,grassAfterFirst:surfaceAt(one,8280,6144),dirtAfterFirst:surfaceAt(one,8120,6144),protectedUnder,leftFloor,rightFloor,expectedLeft,expectedRight};
</script>'''.replace('DEPS',json.dumps(deps))

class Quiet(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)
    def log_message(self,*args):
        pass
    def do_GET(self):
        if self.path=='/organic-fill-proof':
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(HTML.encode())
        else:
            super().do_GET()

server=ThreadingHTTPServer(('127.0.0.1',0),Quiet)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1800,'height':942})
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/organic-fill-proof')
        page.wait_for_function('!!window.result',timeout=90000)
        result=page.evaluate('window.result')
        assert result['curvesBefore']>0,result
        assert result['differingPixels']==0,result
        assert result['heightChanges']==0,result
        assert result['highChanges']==0,result
        assert result['lowerMisses']==0,result
        assert result['grassAfterFirst']=='grass',result
        assert result['dirtAfterFirst']=='dirt',result
        assert result['protectedUnder']==[255,0,255,255],result
        assert result['leftFloor']==result['expectedLeft'],result
        assert result['rightFloor']==result['expectedRight'],result
        assert not errors,errors
        page.screenshot(path=str(ROOT/'docs/town-preview/organic-fill.png'))
        print('Organic fill browser checks passed: exact native dirt pixels after two-sided fill, one-sided contours, raised-bank heights, and portable maps.')
        browser.close()
finally:
    server.shutdown()
