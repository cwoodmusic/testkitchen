/* Integrate generated green accents without moving pixels outside the reviewed
 * masonry mask or changing the counter's original alpha and gold trim. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process'),{createHash}=require('node:crypto');

function wallMask(meta){
 const [width,height]=meta.worldSize,mask=new Uint8Array(width*height),contains=([left,top,w,h],x,y)=>x>=left&&x<left+w&&y>=top&&y<top+h;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)
  if(meta.wallBounds.some(rect=>contains(rect,x,y))&&!meta.protectedBounds.some(rect=>contains(rect,x,y)))mask[y*width+x]=1;
 return mask;
}
function preserveCounterGold(r,g,b){return r>100&&r>=g*.9&&g>b*1.15;}
async function compose({meta,mask},keepGold){
 const load=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load '+url));image.src=url;});
 const [background,wall,before,counter]=await Promise.all(['/backdrop','/wall','/before','/counter'].map(load));
 const canvas=(w,h)=>{const image=document.createElement('canvas');image.width=w;image.height=h;return image;};
 const pixels=(image,w,h)=>{const out=canvas(w,h),ctx=out.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);return {out,ctx,data:ctx.getImageData(0,0,w,h)};};
 const [width,height]=meta.worldSize,[cw,ch]=meta.counterSize;
 if(background.naturalWidth!==width||background.naturalHeight!==height||before.naturalWidth!==cw||before.naturalHeight!==ch)throw Error('Original accent artwork dimensions changed');
 const base=pixels(background,width,height),generatedWall=pixels(wall,width,height),originalBase=base.data.data.slice();let wallChanged=0,wallPixels=0;
 for(let i=0;i<mask.length;i++)if(mask[i]){
  wallPixels++;const at=i*4;
  if([0,1,2].some(channel=>base.data.data[at+channel]!==generatedWall.data.data[at+channel]))wallChanged++;
  for(let channel=0;channel<3;channel++)base.data.data[at+channel]=generatedWall.data.data[at+channel];
 }
 for(let i=0;i<mask.length;i++)if(!mask[i])for(let c=0;c<4;c++)if(base.data.data[i*4+c]!==originalBase[i*4+c])throw Error('Protected backdrop pixel changed');
 base.ctx.putImageData(base.data,0,0);
 const sprite=pixels(before,cw,ch),generatedCounter=pixels(counter,cw,ch),originalCounter=sprite.data.data.slice();let counterChanged=0,preservedGold=0;
 for(let i=0;i<cw*ch;i++){
  const at=i*4,rgba=originalCounter.slice(at,at+4);
  if(!rgba[3])continue;
  if(keepGold(...rgba)){preservedGold++;continue;}
  // If generated edges drift inward, retain the original edge colors rather
  // than introducing a black fringe inside the unchanged original silhouette.
  if(generatedCounter.data.data[at+3]<64)continue;
  if([0,1,2].some(c=>sprite.data.data[at+c]!==generatedCounter.data.data[at+c]))counterChanged++;
  for(let c=0;c<3;c++)sprite.data.data[at+c]=generatedCounter.data.data[at+c];
 }
 for(let i=0;i<cw*ch;i++)if(sprite.data.data[i*4+3]!==originalCounter[i*4+3])throw Error('Counter silhouette alpha changed');
 sprite.ctx.putImageData(sprite.data,0,0);
 return {backdrop:base.out.toDataURL('image/png'),counter:sprite.out.toDataURL('image/png'),wallPixels,wallChanged,counterChanged,preservedGold,protectedBackdropPixels:width*height-wallPixels};
}
async function build(options={}){
 const root=path.resolve(__dirname,'..'),meta=JSON.parse(await fs.readFile(path.join(__dirname,'green-accents-regions.json'),'utf8')),baseline=await fs.readFile(path.join(root,meta.counterBefore));
 if(createHash('sha256').update(baseline).digest('hex')!==meta.counterBaselineSha256)throw Error('The original counter source has changed');
 const files={'/backdrop':meta.backdrop,'/wall':meta.backdropSource,'/before':meta.counterBefore,'/counter':meta.counterSource};
 for(const file of Object.values(files))await fs.access(path.join(root,file));
 const server=http.createServer(async(req,res)=>{try{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Green accent compositor</title>');return;}
  if(!files[req.url]){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','image/png');res.end(await fs.readFile(path.join(root,files[req.url])));
 }catch(error){res.writeHead(500);res.end(error.message);}});
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-green-accents-'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let n=0;n<100;n++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let next=1;const jobs=new Map(),events=new Map();
  socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const job=jobs.get(msg.id);if(!job)return;jobs.delete(msg.id);clearTimeout(job.timer);msg.error?job.reject(Error(msg.error.message)):job.resolve(msg.result);}else events.get(msg.method)?.(msg.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=next++,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Timed out: '+method));},30000);jobs.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>events.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await loaded;
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${compose.toString()})(${JSON.stringify({meta,mask:Array.from(wallMask(meta))})},${preserveCounterGold.toString()})`});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  const {backdrop,counter,...report}=result.result.value;
  if(!options.dryRun){
   await fs.writeFile(path.join(root,meta.backdrop),Buffer.from(backdrop.split(',')[1],'base64'));
   await fs.writeFile(path.join(root,meta.counter),Buffer.from(counter.split(',')[1],'base64'));
  }
  process.stdout.write(JSON.stringify({greenAccents:report,dryRun:!!options.dryRun})+'\n');return report;
 }finally{socket?.close();browser.kill('SIGTERM');server.close();if(browser.exitCode===null)await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(require.main===module)build({dryRun:process.argv.includes('--dry-run')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={wallMask,preserveCounterGold,build};
