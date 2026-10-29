/* Composite the image-generated floor plate into native floor pixels only.
 * The original map/atlas, lounge, colored dance tiles and object art stay
 * intact. Commit the generated PNGs; the static game needs no build step.
 */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http'),vm=require('node:vm');
const {spawn,execFileSync}=require('node:child_process');

async function compose({meta,parts,catalog,updatePlate}){
 const image=url=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not load '+url));img.src=url;});
 const [original,source,atlas,previous]=await Promise.all(['/original','/source','/atlas',...(updatePlate?['/previous-floor']:[])].map(image));
 const [W,H]=meta.worldSize;
 if([original,source,...(previous?[previous]:[])].some(img=>img.naturalWidth!==W||img.naturalHeight!==H))throw Error('Floor plate and original must match the native world dimensions.');
 const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
 const output=canvas(W,H),ctx=output.getContext('2d',{willReadFrequently:true});ctx.drawImage(original,0,0);
 const old=ctx.getImageData(0,0,W,H),plate=canvas(W,H),pg=plate.getContext('2d',{willReadFrequently:true}),mask=new Uint8Array(W*H);
 const a=canvas(atlas.naturalWidth,atlas.naturalHeight),ag=a.getContext('2d',{willReadFrequently:true});ag.drawImage(atlas,0,0);
 const atlasImage=ag.getImageData(0,0,a.width,a.height),atlasPixels=atlasImage.data;
 const inside=(polygon,x,y)=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const p=polygon[i],q=polygon[j];if((p[1]>y)!==(q[1]>y)&&x<(q[0]-p[0])*(y-p[1])/(q[1]-p[1])+p[0])hit=!hit;
 }return hit;};
 const edgeDistance=(polygon,x,y)=>Math.min(...polygon.map((a,i)=>{
  const b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
 }));
 if(updatePlate){
  if(!meta.plateEditPolygons?.length)throw Error('Missing scoped floor-plate edit regions.');
  pg.drawImage(previous,0,0);const base=pg.getImageData(0,0,W,H);
  const replacement=canvas(W,H),rg=replacement.getContext('2d',{willReadFrequently:true});rg.drawImage(source,0,0);
  const generated=rg.getImageData(0,0,W,H).data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const scopes=meta.plateEditPolygons.filter(p=>inside(p,x+.5,y+.5));if(!scopes.length)continue;
   const mix=Math.min(1,Math.max(...scopes.map(p=>edgeDistance(p,x+.5,y+.5)))/16),at=(y*W+x)*4;
   for(let c=0;c<3;c++)base.data[at+c]=Math.round(base.data[at+c]*(1-mix)+generated[at+c]*mix);
  }
  pg.putImageData(base,0,0);
 }else pg.drawImage(source,0,0);
 const floor=pg.getImageData(0,0,W,H).data;
 let trimmedAtlasPixels=0;
 for(const cut of meta.foregroundFloorCuts||[]){
  const part=parts.find(item=>item.name===cut.name);if(!part)throw Error('Unknown foreground floor cut: '+cut.name);
  const [x,y,w,h]=part.bounds,[ax,ay]=part.atlas;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(cut.polygons.some(p=>inside(p,x+xx+.5,y+yy+.5))){
   const at=((ay+yy)*a.width+ax+xx)*4;if(atlasPixels[at+3])trimmedAtlasPixels++;atlasPixels[at+3]=0;
  }
 }
 ag.putImageData(atlasImage,0,0);
 if(meta.preserveForegroundAlpha)for(const part of parts){
  const [x,y,w,h]=part.bounds,[ax,ay]=part.atlas;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(atlasPixels[((ay+yy)*a.width+ax+xx)*4+3])mask[(y+yy)*W+x+xx]=1;
 }
 const polygons=[...(meta.protectedPolygons||[])];
 for(const name of meta.protectCatalogObjects||[]){
  const item=catalog.find(part=>part.name===name);if(!item)throw Error('Unknown protected world object: '+name);
  const [x,y,w,h]=item.bounds;polygons.push(item.polygon||[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
 }
 for(const polygon of polygons){
  const left=Math.max(0,Math.floor(Math.min(...polygon.map(p=>p[0])))),right=Math.min(W,Math.ceil(Math.max(...polygon.map(p=>p[0]))));
  const top=Math.max(0,Math.floor(Math.min(...polygon.map(p=>p[1])))),bottom=Math.min(H,Math.ceil(Math.max(...polygon.map(p=>p[1]))));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(inside(polygon,x+.5,y+.5))mask[y*W+x]=1;
 }
 for(const [x,y,w,h]of meta.protectedBounds||[])for(let yy=Math.max(0,y);yy<Math.min(H,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(W,x+w);xx++)mask[yy*W+xx]=1;
 for(const [y,x0,x1]of meta.protectedPixelRuns||[]){
  if(![y,x0,x1].every(Number.isInteger)||y<0||y>=H||x0<0||x1>W||x0>=x1)throw Error('Invalid protected pixel run.');
  mask.fill(1,y*W+x0,y*W+x1);
 }
 let changed=0,allowed=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const index=y*W+x;if(mask[index]||!meta.floorPolygons.some(p=>inside(p,x+.5,y+.5)))continue;
  allowed++;const at=index*4;
  if(old.data[at]!==floor[at]||old.data[at+1]!==floor[at+1]||old.data[at+2]!==floor[at+2])changed++;
  old.data[at]=floor[at];old.data[at+1]=floor[at+1];old.data[at+2]=floor[at+2];
 }
 ctx.putImageData(old,0,0);
 return {image:output.toDataURL('image/png'),foreground:a.toDataURL('image/png'),...(updatePlate?{floorPlate:plate.toDataURL('image/png')}:{}),allowedPixels:allowed,changedPixels:changed,trimmedAtlasPixels,protectedAtlasParts:parts.length};
}

async function main(){
 const root=path.resolve(__dirname,'..'),meta=JSON.parse(await fs.readFile(path.join(__dirname,'flat-floor-regions.json'),'utf8'));
 const patchIndex=process.argv.indexOf('--update-plate'),updatePlate=patchIndex!==-1;
 const sourceArg=updatePlate?process.argv[patchIndex+1]:process.argv[2];
 if(updatePlate&&!sourceArg)throw Error('Usage: node scripts/build-flat-floor.cjs --update-plate /path/to/generated-floor.png');
 const source=sourceArg?path.resolve(sourceArg):path.join(root,'assets/world/arcade-flat-floor-plate.png');
 const html=await fs.readFile(path.join(root,'world-preview.html'),'utf8');
 const parts=JSON.parse(html.match(/const foregroundParts=(\[.*?\]);/s)[1]);
 for(const match of html.matchAll(/foregroundParts\.push\(\.\.\.(\[.*?\])\);/g))parts.push(...JSON.parse(match[1]));
 for(const match of html.matchAll(/foregroundParts\.push\((\{[^\n]*?\})\);/g))parts.push(JSON.parse(match[1].replace(/([{,])(\w+):/g,'$1"$2":')));
 const scope={window:{}};vm.runInNewContext(await fs.readFile(path.join(root,'world-object-catalog.js'),'utf8'),scope,{timeout:1000});
 const catalog=scope.window.CodaWorldObjectCatalog;
 const files={'/original':path.join(root,'coda_arcade_world_clean.png'),'/source':source,'/atlas':path.join(root,'coda_arcade_foreground_clean.png')};
 if(updatePlate){
  if(!/^[a-f0-9]{40}$/.test(meta.plateBaseRevision||''))throw Error('Invalid floor-plate base revision.');
  files['/previous-floor']=execFileSync('git',['show',meta.plateBaseRevision+':assets/world/arcade-flat-floor-plate.png'],{cwd:root,maxBuffer:16*1024*1024});
 }
 const server=http.createServer(async(req,res)=>{try{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Scoped flat arcade floor</title>');return;}
  if(!files[req.url]){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','image/png');res.end(Buffer.isBuffer(files[req.url])?files[req.url]:await fs.readFile(files[req.url]));
 }catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-flat-floor-builder-'));
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start.');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let nextId=1;const pending=new Map(),listeners=new Map();
  socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const job=pending.get(msg.id);if(!job)return;pending.delete(msg.id);clearTimeout(job.timer);msg.error?job.reject(Error(msg.error.message)):job.resolve(msg.result);}else listeners.get(msg.method)?.(msg.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=nextId++,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out: '+method));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await loaded;
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${compose.toString()})(${JSON.stringify({meta,parts,catalog,updatePlate})})`});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  const {image,foreground,floorPlate,...report}=result.result.value;
  if(report.changedPixels<100000)throw Error('Floor mask changed unexpectedly few pixels.');
  await fs.writeFile(path.join(root,'assets/world/arcade-flat-floor-world.png'),Buffer.from(image.split(',')[1],'base64'));
  await fs.writeFile(path.join(root,'assets/world/arcade-flat-floor-foreground.png'),Buffer.from(foreground.split(',')[1],'base64'));
  if(floorPlate)await fs.writeFile(path.join(root,'assets/world/arcade-flat-floor-plate.png'),Buffer.from(floorPlate.split(',')[1],'base64'));
  console.log(JSON.stringify(report));
 }finally{
  socket?.close();server.close();const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill('SIGTERM');
  let timer;await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(resolve,5000);})]);clearTimeout(timer);
  await fs.rm(profile,{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
