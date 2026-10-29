/* Apply the image-generated sofa repair through a pixel-exact, scoped mask.
 * Canvas does compositing only: the couch artwork is the checked-in generated
 * source. Re-running is idempotent; no other world/atlas pixels are rewritten.
 */
'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {spawn}=require('node:child_process');

async function compose(meta){
 const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load '+src));image.src=src;});
 const [original,foreground,source]=await Promise.all(['/world','/foreground','/source'].map(load));
 const [width,height]=meta.worldSize;
 if(original.naturalWidth!==width||original.naturalHeight!==height||source.naturalWidth!==meta.sourceSize[0]||source.naturalHeight!==meta.sourceSize[1])throw Error('Unexpected repair image dimensions');
 const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
 const world=canvas(width,height),wg=world.getContext('2d',{willReadFrequently:true});wg.drawImage(original,0,0);
 const atlas=canvas(foreground.naturalWidth,foreground.naturalHeight),ag=atlas.getContext('2d',{willReadFrequently:true});ag.drawImage(foreground,0,0);
 const patch=canvas(width,height),pg=patch.getContext('2d',{willReadFrequently:true});pg.imageSmoothingEnabled=false;pg.drawImage(source,...meta.target);
 const mask=canvas(width,height),mg=mask.getContext('2d',{willReadFrequently:true});mg.fillStyle='#fff';mg.beginPath();mg.moveTo(...meta.polygon[0]);for(const point of meta.polygon.slice(1))mg.lineTo(...point);mg.closePath();mg.fill();
 const coverage=mg.getImageData(0,0,width,height).data,pixels=pg.getImageData(0,0,width,height).data;
 const worldPixels=wg.getImageData(0,0,width,height),atlasPixels=ag.getImageData(0,0,atlas.width,atlas.height);
 const [bx,by,bw,bh]=meta.foreground.bounds,[ax,ay]=meta.foreground.atlas;let changed=0,expanded=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=(y*width+x)*4;if(coverage[at+3]<128)continue;
  if(x<bx||x>=bx+bw||y<by||y>=by+bh)throw Error('Couch repair exceeds the movable foreground bounds');
  for(let channel=0;channel<4;channel++)worldPixels.data[at+channel]=pixels[at+channel];
  const tile=((ay+y-by)*atlas.width+ax+x-bx)*4;
  if(atlasPixels.data[tile+3]<255)expanded++;
  for(let channel=0;channel<4;channel++)atlasPixels.data[tile+channel]=pixels[at+channel];
  changed++;
 }
 wg.putImageData(worldPixels,0,0);ag.putImageData(atlasPixels,0,0);
 return {world:world.toDataURL('image/png'),foreground:atlas.toDataURL('image/png'),pixels:changed,expanded};
}

async function main(){
 const root=path.resolve(__dirname,'..'),meta=JSON.parse(await fs.readFile(path.join(__dirname,'dance-couch-repair.json'),'utf8'));
 const files={'/world':'coda_arcade_world_clean.png','/foreground':'coda_arcade_foreground_clean.png','/source':meta.source};
 const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Scoped couch repair</title>');return;}if(!files[req.url]){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','image/png');res.end(await fs.readFile(path.join(root,files[req.url])));}catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-couch-builder-'));
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let nextId=1;const pending=new Map(),listeners=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const job=pending.get(message.id);if(!job)return;pending.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);}else listeners.get(message.method)?.(message.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=nextId++,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out: '+method));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await loaded;
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${compose.toString()})(${JSON.stringify(meta)})`});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  const data=result.result.value;
  for(const [key,file]of [['world',files['/world']],['foreground',files['/foreground']]])await fs.writeFile(path.join(root,file),Buffer.from(data[key].split(',')[1],'base64'));
  console.log(JSON.stringify({pixels:data.pixels,expandedForegroundPixels:data.expanded,foreground:meta.foreground.name}));
 }finally{socket?.close();const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill('SIGTERM');server.close();await exited;await fs.rm(profile,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
