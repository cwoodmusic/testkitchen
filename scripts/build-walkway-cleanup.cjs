/* The generated repair includes the approved base + authored wall edits.
 * Bake only the reviewed joins and remove journals only where that image owns
 * the pixels. User objects, collision, other artwork and all layout stay intact. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');
const {inside,rebaseArtwork}=require('./build-cosmic-floor.cjs');

function cleanupMask(meta){
 const [width,height]=meta.worldSize,mask=new Uint8Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)
  if(meta.polygons.some(polygon=>inside(polygon,x+.5,y+.5))&&!(meta.protectedPolygons||[]).some(polygon=>inside(polygon,x+.5,y+.5)))mask[y*width+x]=1;
 if(meta.protectedShape){
  const shape=require(path.resolve(__dirname,'..',meta.protectedShape));
  if(shape.version!==1||shape.width!==width||shape.height!==height||!Array.isArray(shape.deltaRuns))throw Error('Unsupported protected pathway shape');
  // The later user export owns its exact new wall outline and erased floor.
  // Earlier generated cleanup must not restore the previous diagonal here.
  for(const [y,x0,x1]of shape.deltaRuns){
   if(![y,x0,x1].every(Number.isInteger)||y<0||y>=height||x0<0||x1>width||x0>=x1)throw Error('Invalid protected pathway run');
   mask.fill(0,y*width+x0,y*width+x1);
  }
 }
 return mask;
}
function tileEdgeWeight(feather,x,y){
 const {points,width}=feather;
 if(y<points[0][1]||y>points.at(-1)[1])return 1;
 for(let i=1;i<points.length;i++){
  const [x0,y0]=points[i-1],[x1,y1]=points[i];
  if(y>y1)continue;
  const edge=x0+(x1-x0)*(y-y0)/(y1-y0);
  return Math.max(0,Math.min(1,(edge+width-x)/width));
 }
 return 1;
}
function floorFeatherWeight(feather,x,y){
 if(!feather)return 1;
 const [r0,r1]=feather.right,[b0,b1]=feather.bottom,[l0,l1,below]=feather.leftBelow;
 let weight=Math.max(0,Math.min(1,(r1-x-.5)/(r1-r0),(b1-y-.5)/(b1-b0)));
 if(y>=below)weight=Math.max(0,Math.min(weight,(x+.5-l0)/(l1-l0)));
 if(feather.top){const [t0,t1]=feather.top;weight=Math.max(0,Math.min(weight,(y+.5-t0)/(t1-t0)));}
 return weight;
}
async function compose({meta,mask,previewOnly},tileEdgeWeight,floorFeatherWeight){
 const load=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load '+url));image.src=url;});
 const original=await load('/before'),source=previewOnly?original:await load('/source'),[width,height]=meta.worldSize;
 const [sourceWidth,sourceHeight]=previewOnly?meta.worldSize:meta.sourceSize||meta.worldSize;
 if(original.naturalWidth!==width||original.naturalHeight!==height||source.naturalWidth!==sourceWidth||source.naturalHeight!==sourceHeight)throw Error('Walkway source dimensions must match the declared size');
 const canvas=()=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
 const output=canvas(),g=output.getContext('2d',{willReadFrequently:true}),generated=canvas(),s=generated.getContext('2d',{willReadFrequently:true});
 g.drawImage(original,0,0);s.imageSmoothingEnabled=false;
 const placement=previewOnly?[0,0,width,height]:meta.sourcePlacement||[0,0,width,height];
 if(meta.sourceRect&&!previewOnly)s.drawImage(source,...meta.sourceRect,...placement);
 else s.drawImage(source,...placement);
 if(!previewOnly)for(const region of meta.sourceCopies||[])s.drawImage(generated,...region);
 const before=g.getImageData(0,0,width,height),after=g.getImageData(0,0,width,height),pixels=s.getImageData(0,0,width,height).data;
 let featherPixels=before.data;
 if((meta.floorFeather||meta.tileEdgeFeather)&&!previewOnly){
  const reference=await load('/feather-base');if(reference.naturalWidth!==width||reference.naturalHeight!==height)throw Error('Floor feather reference dimensions must match the world');
  const b=canvas().getContext('2d');b.drawImage(reference,0,0);featherPixels=b.getImageData(0,0,width,height).data;
 }
 let allowed=0,changed=0;
 for(let i=0;i<mask.length;i++)if(mask[i]){
  allowed++;const at=i*4;if([0,1,2,3].some(c=>before.data[at+c]!==pixels[at+c]))changed++;
  // The outside edge of a floor reflection meets existing glass, beyond the
  // removed masonry. Blend there while keeping the new wall face pixel-sharp.
  let weight=floorFeatherWeight(meta.floorFeather,i%width,Math.floor(i/width));
  if(meta.tileEdgeFeather)weight=Math.min(weight,tileEdgeWeight(meta.tileEdgeFeather,i%width+.5,Math.floor(i/width)));
  for(let c=0;c<4;c++)after.data[at+c]=weight<1?Math.round(featherPixels[at+c]*(1-weight)+pixels[at+c]*weight):pixels[at+c];
 }
 for(let i=0;i<mask.length;i++)if(!mask[i])for(let c=0;c<4;c++)if(before.data[i*4+c]!==after.data[i*4+c])throw Error('An unmarked walkway pixel changed');
 g.putImageData(after,0,0);
 const preview=canvas(),p=preview.getContext('2d');p.drawImage(original,0,0);const tint=p.getImageData(0,0,width,height);
 for(let i=0;i<mask.length;i++)if(mask[i]){const at=i*4;tint.data[at]=Math.round(tint.data[at]*.35+165);tint.data[at+1]=Math.round(tint.data[at+1]*.35+128);tint.data[at+2]=Math.round(tint.data[at+2]*.35);}
 p.putImageData(tint,0,0);
 return {image:output.toDataURL('image/png'),preview:preview.toDataURL('image/png'),allowed,changed,protectedPixels:mask.length-allowed};
}
async function build(options={}){
 const root=path.resolve(__dirname,'..'),meta=options.meta||JSON.parse(await fs.readFile(path.join(__dirname,'walkway-cleanup-regions.json'),'utf8')),mask=cleanupMask(meta),projectPath=path.join(root,'published-world-project.json');
 const originalProject=JSON.parse(await fs.readFile(projectPath,'utf8')),rebased=rebaseArtwork(originalProject,mask,meta.worldSize[0]);
 // Native-only finishing passes cannot consume authored edits. A reviewed
 // floor pass may preserve overlapping journals when exact-color render
 // compatibility exposes its replacement; it still never writes the project.
 if(meta.preserveProject&&rebased.removed&&!meta.allowAuthoredFloorCompatibility)throw Error('Native-only repair overlaps '+rebased.removed+' authored background pixels; project data must remain unchanged');
 const files={'/before':meta.output,'/source':meta.source,'/feather-base':meta.before};
 const server=http.createServer(async(req,res)=>{try{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Walkway cleanup compositor</title>');return;}
  if(!files[req.url]){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','image/png');res.end(await fs.readFile(path.join(root,files[req.url])));
 }catch(error){res.writeHead(500);res.end(error.message);}});
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-walkway-cleanup-'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let n=0;n<100;n++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let next=1;const jobs=new Map(),events=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const job=jobs.get(message.id);if(!job)return;jobs.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);}else events.get(message.method)?.(message.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=next++,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Timed out: '+method));},30000);jobs.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>events.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await loaded;
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${compose.toString()})(${JSON.stringify({meta,mask:Array.from(mask),previewOnly:!!options.previewOnly})},${tileEdgeWeight.toString()},${floorFeatherWeight.toString()})`});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  const {image,preview,...report}=result.result.value;
  await fs.writeFile('/tmp/coda-walkway-cleanup-mask.png',Buffer.from(preview.split(',')[1],'base64'));
  if(!options.dryRun&&!options.previewOnly){
   await fs.writeFile(path.join(root,meta.output),Buffer.from(image.split(',')[1],'base64'));
   if(rebased.removed&&!meta.preserveProject)await fs.writeFile(projectPath,JSON.stringify(rebased.project,null,2)+'\n');
  }
  process.stdout.write(JSON.stringify({walkwayCleanup:{...report,removedCoveredJournalPixels:meta.preserveProject?0:rebased.removed,retainedJournalPixels:rebased.retained+(meta.preserveProject?rebased.removed:0),...(meta.preserveProject?{preservedAuthoredOverlapPixels:rebased.removed}:{})},dryRun:!!options.dryRun,previewOnly:!!options.previewOnly})+'\n');return report;
 }finally{socket?.close();browser.kill('SIGTERM');server.close();if(browser.exitCode===null)await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(require.main===module)build({dryRun:process.argv.includes('--dry-run'),previewOnly:process.argv.includes('--preview-mask')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={cleanupMask,tileEdgeWeight,floorFeatherWeight,build};
