"""Inspect actual authored cardinal sprites at unchanged physical anchors."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse,base64,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];parser=argparse.ArgumentParser();parser.add_argument('--owner',default='bach');parser.add_argument('--directions',nargs='+',choices=['south','north','east','west'],default=['south','north','east','west']);parser.add_argument('--slots',nargs='+',default=['bed','sofa','reading-chair','wardrobe','fridge','toilet','arcade','lava-lamp']);parser.add_argument('--screenshots',type=Path,default=Path('/workspace/.onboarding/furniture-facing-native'));args=parser.parse_args();args.screenshots.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':1600,'height':1100});page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.expose_function('__saveFacingImage',lambda name,url:(args.screenshots/(name+'.png')).write_bytes(base64.b64decode(url.split(',')[1])))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
  report=page.evaluate('''async ({owner,requestedDirections,slots})=>{
   const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),{furnitureFacingPlacement,furnitureFacingBoxes}=await import(url('furniture-facing')),{drawApartmentMotion}=await import(url('apartment-motion'));
   const directions=requestedDirections.map(d=>[d,{south:0,north:180,east:270,west:90}[d]]),check=(v,m)=>{if(!v)throw Error(m);},rows=[];
   const sheet=document.createElement('canvas');sheet.width=directions.length*420;sheet.height=slots.length*360+40;const c=sheet.getContext('2d');c.fillStyle='#17232c';c.fillRect(0,0,sheet.width,sheet.height);c.imageSmoothingEnabled=false;
   const digest=async pixels=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(n=>n.toString(16).padStart(2,'0')).join('');
   for(let i=0;i<slots.length;i++){
    const slot=slots[i],a=townBuilder.catalog.get('collection-'+owner+'-'+slot);check(a,'Missing '+slot);const hashes=[];
    for(let j=0;j<directions.length;j++){
     const [direction,rotation]=directions[j];await a.ensureFull(direction);const view=a.getFacingView(direction);check(view?.ready&&view?.canvas,'No full authored '+direction+' '+slot);
     const canvas=view.canvas,pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
     for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>20){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
     check(x1>x0&&y1>y0,'Empty cardinal art');const hash=await digest(pixels);hashes.push(hash);const o={x:0,y:0,scale:1,rotation},placement=furnitureFacingPlacement(a,o),boxes=furnitureFacingBoxes(a,o);check(placement?.direction===direction&&placement.rotation===0,'Furniture was spun instead of rendered upright');
     const b=boxes[0],expected={x:b.x+b.w/2,y:b.y+b.h/2};check(Math.hypot(expected.x-placement.groundCenter.x,expected.y-placement.groundCenter.y)<.001,'Pictured foot center drifted from collider centre');
     const x=j*420,y=40+i*360,cx=x+210,cy=y+230;c.save();c.beginPath();c.rect(x,y,420,360);c.clip();c.fillStyle=i%2?'#20323a':'#1b2c34';c.fillRect(x,y,420,360);c.translate(cx,cy);c.scale(1.2,1.2);c.strokeStyle='#35505b';c.lineWidth=1/1.2;for(let k=-240;k<=240;k+=32){c.beginPath();c.moveTo(k,-240);c.lineTo(k,120);c.moveTo(-240,k);c.lineTo(240,k);c.stroke();}
     c.fillStyle='#ef77772f';c.strokeStyle='#ef7777';for(const b of boxes){c.fillRect(b.x,b.y,b.w,b.h);c.strokeRect(b.x,b.y,b.w,b.h);}c.drawImage(placement.image,placement.x,placement.y,placement.w,placement.h);drawApartmentMotion(c,view,{x:placement.x+placement.w/2,y:placement.y+placement.h,w:placement.w,h:placement.h},.75);
     c.strokeStyle='#f4d97e';c.beginPath();c.moveTo(-5,0);c.lineTo(5,0);c.moveTo(0,-5);c.lineTo(0,5);c.stroke();c.fillStyle='#7af3c1';c.beginPath();c.arc(expected.x,expected.y,3,0,Math.PI*2);c.fill();c.restore();c.fillStyle='#f0ddba';c.font='17px sans-serif';c.fillText(slot+' · '+direction,x+14,y+24);c.font='13px sans-serif';c.fillText('visible '+(x1-x0+1)+'×'+(y1-y0+1)+' / view '+view.w+'×'+view.h,x+14,y+340);
     rows.push({slot,direction,rotation,viewWidth:view.w,viewHeight:view.h,alphaWidth:x1-x0+1,alphaHeight:y1-y0+1,hash,physicalBoxes:boxes,footCenter:placement.groundCenter,picturedBounds:placement.bounds,motion:view.motion?.kind||null});
     if(slot==='arcade'&&direction==='north')check(!view.motion,'Rear arcade has a screen animation');
    }
    check(new Set(hashes).size===directions.length,'Cardinal views repeat the same rendered art: '+slot);
   }
   await __saveFacingImage(owner+'-cardinal-contact',sheet.toDataURL());return {owner,rows};
  }''',{'owner':args.owner,'requestedDirections':args.directions,'slots':args.slots})
  assert not errors,errors;browser.close();report['pageErrors']=errors;(args.screenshots/'results.json').write_text(json.dumps(report,indent=2));print(json.dumps({'owner':args.owner,'views':len(report['rows']),'pageErrors':errors}),flush=True)
finally:server.shutdown()
