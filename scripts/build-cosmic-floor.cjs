/* Composite generated palette artwork into an explicit floor mask. The native
 * architecture and every non-floor world-project field remain unchanged. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process'),{createHash}=require('node:crypto'),assert=require('node:assert/strict');

function inside(polygon,x,y){
 let result=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)result=!result;
 }
 return result;
}
function floorMask(meta){
 const [width,height]=meta.worldSize,mask=new Uint8Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(!meta.floorPolygons.some(p=>inside(p,x+.5,y+.5)))continue;
  if(meta.protectedPolygons.some(p=>inside(p,x+.5,y+.5)))continue;
  if(meta.protectedBounds.some(([left,top,w,h])=>x>=left&&x<left+w&&y>=top&&y<top+h))continue;
  mask[y*width+x]=1;
 }
 return mask;
}
function authoredShapeMask(meta,shape){
 const [width,height]=meta.worldSize,mask=new Uint8Array(width*height);
 if(shape.version!==1||shape.width!==width||shape.height!==height||!Array.isArray(shape.deltaRuns))throw Error('Unsupported authored pathway shape');
 for(const [y,x0,x1]of shape.deltaRuns){
  if(![y,x0,x1].every(Number.isInteger)||y<0||y>=height||x0<0||x1>width||x0>=x1)throw Error('Invalid authored pathway run');
  mask.fill(1,y*width+x0,y*width+x1);
 }
 return mask;
}
function rebaseArtwork(project,mask,width,preserveRepair,protectedMask){
 const next=structuredClone(project),texture=next.artwork?.['background.world'];let removed=0,retained=0;
 if(!texture)return {project:next,removed,retained};
 for(const [key,runs]of Object.entries(texture.tiles)){
  const [tx,ty]=key.split(',').map(Number),kept=[];
  for(const [start,length,color]of runs)for(let index=start;index<start+length;index++){
   const x=tx*64+index%64,y=ty*64+Math.floor(index/64);
   const keepRepair=preserveRepair&&x>=preserveRepair.bounds[0]&&x<preserveRepair.bounds[0]+preserveRepair.bounds[2]&&y>=preserveRepair.bounds[1]&&y<preserveRepair.bounds[1]+preserveRepair.bounds[3];
   // Authored wall-covering floor paint keeps its silhouette even when a
   // later native floor mask expands underneath it. Recolor rather than erase.
   if(mask[y*width+x]&&!keepRepair&&!protectedMask?.[y*width+x]){removed++;continue;}
   retained++;const last=kept.at(-1);
   if(last&&last[0]+last[1]===index&&last[2]===color)last[1]++;
   else kept.push([index,1,color]);
  }
  if(kept.length)texture.tiles[key]=kept;else delete texture.tiles[key];
 }
 if(!Object.keys(texture.tiles).length){delete next.artwork['background.world'];if(!Object.keys(next.artwork).length)delete next.artwork;}
 const omitBackground=data=>{const copy=structuredClone(data);if(copy.artwork){delete copy.artwork['background.world'];if(!Object.keys(copy.artwork).length)delete copy.artwork;}return copy;};
 assert.deepEqual(omitBackground(next),omitBackground(project),'Only floor-overlapping background journal pixels may change');
 return {project:next,removed,retained};
}
function repairPoints(project,repair,protectedMask){
 const [left,top,width,height]=repair.bounds,result=[];
 for(const [key,runs]of Object.entries(project.artwork?.['background.world']?.tiles||{})){
  const [tx,ty]=key.split(',').map(Number);
  for(const [start,length,color]of runs)for(let i=start;i<start+length;i++){
   const x=tx*64+i%64,y=ty*64+Math.floor(i/64);
   if(protectedMask?.[y*project.artwork['background.world'].width+x])continue;
   if(x<left||x>=left+width||y<top||y>=top+height)continue;
   if(repair.blueFloorOnly){
    const [r,g,b]=[1,3,5].map(at=>parseInt(color.slice(at,at+2),16));
    if(!(b>r*1.4&&b>g*1.4))continue;
   }
   result.push([x,y]);
  }
 }
 return result;
}
function recolorRepairs(project,samples){
 const next=structuredClone(project),colors=new Map(samples.map(([x,y,rgb])=>[x+','+y,rgb]));let changed=0;
 for(const [key,runs]of Object.entries(next.artwork?.['background.world']?.tiles||{})){
  const [tx,ty]=key.split(',').map(Number),recolored=[];
  for(const [start,length,color]of runs)for(let i=start;i<start+length;i++){
   const rgb=colors.get((tx*64+i%64)+','+(ty*64+Math.floor(i/64))),value=rgb?rgb+color.slice(7):color,last=recolored.at(-1);
   if(value!==color)changed++;
   if(last&&last[0]+last[1]===i&&last[2]===value)last[1]++;else recolored.push([i,1,value]);
  }
  next.artwork['background.world'].tiles[key]=recolored;
 }
 return {project:next,changed};
}
async function compose({meta,mask,previewOnly,repairPoints}){
 const load=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load '+url));image.src=url;});
 const original=await load('/baseline'),source=previewOnly?original:await load('/source'),[width,height]=meta.worldSize;
 if(original.naturalWidth!==width||original.naturalHeight!==height)throw Error('Baseline dimensions do not match the world');
 if(source.naturalWidth<1||source.naturalHeight<1||source.naturalWidth>8192||source.naturalHeight>8192)throw Error('Generated source dimensions are invalid');
 const canvas=()=>{const result=document.createElement('canvas');result.width=width;result.height=height;return result;};
 const output=canvas(),g=output.getContext('2d',{willReadFrequently:true});g.drawImage(original,0,0);
 const before=g.getImageData(0,0,width,height),after=g.getImageData(0,0,width,height),generated=canvas(),gg=generated.getContext('2d',{willReadFrequently:true});
 gg.drawImage(source,0,0,width,height);const pixels=gg.getImageData(0,0,width,height).data;
 let allowed=0,changed=0;
 for(let i=0;i<mask.length;i++)if(mask[i]){
  allowed++;const offset=i*4;
  if([0,1,2,3].some(channel=>before.data[offset+channel]!==pixels[offset+channel]))changed++;
  for(let channel=0;channel<4;channel++)after.data[offset+channel]=pixels[offset+channel];
 }
 for(let i=0;i<mask.length;i++)if(!mask[i])for(let channel=0;channel<4;channel++)if(before.data[i*4+channel]!==after.data[i*4+channel])throw Error('Protected pixel changed');
 g.putImageData(after,0,0);
 const preview=canvas(),pg=preview.getContext('2d');pg.drawImage(original,0,0);const tint=pg.getImageData(0,0,width,height);
 for(let i=0;i<mask.length;i++)if(mask[i]){const at=i*4;tint.data[at]=Math.round(tint.data[at]*.35+165);tint.data[at+1]=Math.round(tint.data[at+1]*.35+128);tint.data[at+2]=Math.round(tint.data[at+2]*.35);}
 pg.putImageData(tint,0,0);
 const [dx,dy]=meta.authoredFloorRepair.sampleOffset,repairSamples=repairPoints.map(([x,y])=>{
  const sx=x+dx,sy=y+dy;if(sx<0||sy<0||sx>=width||sy>=height)throw Error('Floor repair sample is outside the generated image');
  const at=(sy*width+sx)*4;return [x,y,'#'+[...pixels.slice(at,at+3)].map(value=>value.toString(16).padStart(2,'0')).join('')];
 });
 return {image:output.toDataURL('image/png'),preview:preview.toDataURL('image/png'),repairSamples,allowed,changed,protectedPixels:mask.length-allowed,sourceSize:[source.naturalWidth,source.naturalHeight]};
}
async function main(){
 const root=path.resolve(__dirname,'..'),meta=JSON.parse(await fs.readFile(path.join(__dirname,'cosmic-floor-regions.json'),'utf8')),previewOnly=process.argv.includes('--preview-mask'),dryRun=process.argv.includes('--dry-run');
 const baseline=await fs.readFile(path.join(root,meta.baseline));
 if(createHash('sha256').update(baseline).digest('hex')!==meta.baselineSha256)throw Error('The immutable original backdrop has changed');
 const protectedMask=meta.protectedShape?authoredShapeMask(meta,JSON.parse(await fs.readFile(path.join(root,meta.protectedShape),'utf8'))):null;
 const mask=floorMask(meta),projectPath=path.join(root,'published-world-project.json'),originalProject=JSON.parse(await fs.readFile(projectPath,'utf8')),rebased=rebaseArtwork(originalProject,mask,meta.worldSize[0],meta.authoredFloorRepair,protectedMask);
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-cosmic-floor-')),server=http.createServer(async(req,res)=>{try{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Cosmic floor compositor</title>');return;}
  if(!['/baseline','/source'].includes(req.url)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','image/png');res.end(req.url==='/baseline'?baseline:await fs.readFile(path.join(root,meta.source)));
 }catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let nextId=1;const jobs=new Map(),listeners=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const job=jobs.get(message.id);if(!job)return;jobs.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);}else listeners.get(message.method)?.(message.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=nextId++,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Timed out: '+method));},30000);jobs.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await loaded;
  const points=repairPoints(rebased.project,meta.authoredFloorRepair,protectedMask);
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${compose.toString()})(${JSON.stringify({meta,mask:Array.from(mask),previewOnly,repairPoints:points})})`});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  const {image,preview,repairSamples,...report}=result.result.value,recolored=recolorRepairs(rebased.project,repairSamples);
  await fs.writeFile('/tmp/coda-cosmic-floor-mask.png',Buffer.from(preview.split(',')[1],'base64'));
  if(!previewOnly&&!dryRun){
   if(report.changed<100000)throw Error('The palette changed unexpectedly few floor pixels');
   await fs.writeFile(path.join(root,meta.output),Buffer.from(image.split(',')[1],'base64'));
   if(rebased.removed||recolored.changed)await fs.writeFile(projectPath,JSON.stringify(recolored.project,null,2)+'\n');
  }
  process.stdout.write(JSON.stringify({...report,removedFloorJournalPixels:rebased.removed,retainedJournalPixels:rebased.retained,recoloredRepairPixels:recolored.changed,repairCoverage:points.length,previewOnly,dryRun,maskPreview:'/tmp/coda-cosmic-floor-mask.png'})+'\n');
 }finally{
  socket?.close();browser.kill('SIGTERM');server.close();if(browser.exitCode===null)await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true});
 }
 if(!previewOnly&&!dryRun)await require('./build-green-accents.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-walkway-cleanup.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-boutique-rectangle.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-stage-wall.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-boutique-flat-top.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-boutique-join.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-boutique-corner-cap.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-hall-roof-cap.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-lounge-club-roof.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-dance-northwest-south-wall.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-arcade-north-straight-cap.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-five-northwest-cleanup.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-front-wall-depth.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-sign-green-completion.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-hall-floor-repair.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-dance-northwest-finish.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-boutique-wall-uniform.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-dance-main-wall-uniform.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-dance-floor-blend.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-source-reflections.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-dance-reflections.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-east-floor-cleanup.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-lounge-floor.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-arcade-finishes.cjs').build();
 if(!previewOnly&&!dryRun)await require('./build-west-neon-uniform.cjs').build();
}
if(require.main===module)main().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={inside,floorMask,authoredShapeMask,rebaseArtwork,repairPoints,recolorRepairs};
