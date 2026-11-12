"""The asynchronous water bitmap matches the synchronous native pixels exactly."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/maps/')
  result=page.evaluate('''async()=>{
   const {waterFrame,WATER_FPS}=await import('../world/water-motion.mjs?v=opera-smooth-1'),make=()=>{const c=document.createElement('canvas');c.width=32;c.height=24;const g=c.getContext('2d'),p=g.createImageData(32,24);for(let i=0;i<32*24;i++){p.data.set([i*7%256,i*11%256,i*31%256,255],i*4);}g.putImageData(p,0,0);return c;};
   const read=image=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const g=c.getContext('2d');g.drawImage(image,0,0);return Array.from(g.getImageData(0,0,c.width,c.height).data);},check=(v,m)=>{if(!v)throw Error(m);};
   const Native=window.Worker,workers=[],messages=[];window.Worker=class extends Native{constructor(...args){super(...args);workers.push(this);this.addEventListener('message',e=>messages.push(e.data.index));}};
   const threaded=make(),still=waterFrame(threaded,0),indices=[1,17,63,143],checks=[];
   for(const index of indices){
    const time=index/WATER_FPS+.0001,previous=waterFrame(threaded,time),count=messages.length;
    for(let i=0;i<8;i++)check(waterFrame(threaded,time)===previous,'Repeated animation frames should reuse the completed image');
    const deadline=performance.now()+5000;while(messages.length===count){check(performance.now()<deadline,'Water worker stalled');await new Promise(r=>setTimeout(r,5));}
    if(checks.length)check(previous.width===0,'Replaced worker bitmap was not released');
    const actual=read(waterFrame(threaded,time));window.Worker=undefined;const expected=read(waterFrame(make(),time));window.Worker=class extends Native{constructor(...args){super(...args);workers.push(this);}};
    check(actual.every((v,i)=>v===expected[i]),'Worker/native pixel mismatch at frame '+index);checks.push(index);
   }
   check(workers.length===1,'More than one worker for the same water texture');check(waterFrame(threaded,12)===still,'Loop boundary must restore native water');
   window.Worker=class{constructor(){throw Error('No workers');}};const fallback=read(waterFrame(make(),17/WATER_FPS+.0001));window.Worker=undefined;const native=read(waterFrame(make(),17/WATER_FPS+.0001));check(fallback.every((v,i)=>v===native[i]),'Worker startup failure broke the synchronous fallback');
   workers.forEach(w=>w.terminate());window.Worker=Native;return {indices:checks,workers:workers.length,exactPixels:true};
  }''')
  assert not errors,errors;print(json.dumps(result));browser.close()
finally:server.shutdown()
