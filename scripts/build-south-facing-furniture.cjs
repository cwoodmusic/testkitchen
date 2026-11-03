/* Normalize generated furniture onto the existing logical canvases. Original
 * source sprites, object placements and the world backdrop remain untouched. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process'),{createHash}=require('node:crypto');

function alphaBounds(data,width,height,threshold=8){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>threshold){
  left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
 }
 return right<left?null:{x:left,y:top,width:right-left+1,height:bottom-top+1};
}
function bottomRect(sourceWidth,sourceHeight,width,height,maxWidth){
 if(![sourceWidth,sourceHeight,width,height,maxWidth].every(n=>Number.isInteger(n)&&n>0)||maxWidth>width)throw Error('Invalid bottom-aligned furniture dimensions');
 const scale=Math.min(maxWidth/sourceWidth,height/sourceHeight),w=Math.max(1,Math.min(maxWidth,Math.round(sourceWidth*scale))),h=Math.max(1,Math.min(height,Math.round(sourceHeight*scale)));
 return {x:Math.floor((width-w)/2),y:height-h,width:w,height:h};
}
function outputPaths(item){
 return [...(item.environmentOutput?[item.environmentOutput]:[]),'assets/decor/v1/'+item.id+'.png'];
}
function validateMetadata(meta){
 if(meta.version!==1||!Array.isArray(meta.items)||!meta.items.length||!Number.isInteger(meta.alphaThreshold)||meta.alphaThreshold<0||meta.alphaThreshold>254)throw Error('Unsupported furniture metadata');
 const inputs=new Set(meta.items.map(item=>item.source)),ids=new Set(),outputs=new Set();
 for(const item of meta.items){
  if(!/^[a-z0-9-]+$/.test(item.id)||ids.has(item.id)||!['bottom','center'].includes(item.mode)||![item.width,item.height].every(n=>Number.isInteger(n)&&n>1&&n<=8192))throw Error('Invalid furniture item: '+item.id);
  ids.add(item.id);
  if(item.mode==='bottom'&&(!Number.isInteger(item.maxWidth)||item.maxWidth<1||item.maxWidth>item.width))throw Error('Invalid visible width: '+item.id);
  for(const output of outputPaths(item)){
   if(!/^assets\/(environment|decor)\/v1\/[a-z0-9-]+\.png$/.test(output)||inputs.has(output)||outputs.has(output))throw Error('Furniture output must be a new, distinct PNG: '+output);
   outputs.add(output);
  }
 }
 return {inputs:[...inputs],outputs:[...outputs]};
}
async function normalize(meta,alphaBounds,bottomRect){
 const load=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not decode '+url));image.src=url;});
 const images=new Map(),result=[];
 for(const item of meta.items){
  if(!images.has(item.source))images.set(item.source,await load('/input/'+meta.sources.indexOf(item.source)));
  const image=images.get(item.source),sw=image.naturalWidth,sh=image.naturalHeight;
  if(!CodaEnvironmentArt.validSourceSize(sw,sh))throw Error('Unsupported furniture source dimensions: '+item.source);
  const source=document.createElement('canvas');source.width=sw;source.height=sh;const s=source.getContext('2d',{willReadFrequently:true});s.drawImage(image,0,0);
  const rgba=s.getImageData(0,0,sw,sh).data,bounds=alphaBounds(rgba,sw,sh,meta.alphaThreshold);
  if(!bounds)throw Error('Furniture source is empty: '+item.source);
  let crop={x:0,y:0,width:sw,height:sh},rect;
  if(item.mode==='bottom'){
   const corners=[3,(sw-1)*4+3,(sh-1)*sw*4+3,(sw*sh-1)*4+3].map(at=>rgba[at]);
   if(corners.some(alpha=>alpha>meta.alphaThreshold))throw Error('Generated furniture needs a transparent background: '+item.source);
   crop=bounds;rect=bottomRect(crop.width,crop.height,item.width,item.height,item.maxWidth);
  }else rect=CodaEnvironmentArt.fitRect(sw,sh,item.width,item.height);
  let canvas=document.createElement('canvas');canvas.width=item.width;canvas.height=item.height;let g=canvas.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;
  g.drawImage(image,crop.x,crop.y,crop.width,crop.height,rect.x,rect.y,rect.width,rect.height);
  let pixels=g.getImageData(0,0,item.width,item.height).data,visible=alphaBounds(pixels,item.width,item.height,meta.alphaThreshold),baselineAdjustment=0;
  if(!visible)throw Error('Normalized furniture is empty: '+item.id);
  // Nearest-neighbour sampling can miss a source's last isolated foot pixel.
  // Align the actual visible result, rather than leaving it floating a row up.
  if(item.mode==='bottom'&&visible.y+visible.height<item.height){
   baselineAdjustment=item.height-visible.y-visible.height;const aligned=document.createElement('canvas');aligned.width=item.width;aligned.height=item.height;
   const a=aligned.getContext('2d',{willReadFrequently:true});a.imageSmoothingEnabled=false;a.drawImage(canvas,0,baselineAdjustment);canvas=aligned;g=a;
   pixels=g.getImageData(0,0,item.width,item.height).data;visible=alphaBounds(pixels,item.width,item.height,meta.alphaThreshold);
  }
  const corners=[3,(item.width-1)*4+3,(item.height-1)*item.width*4+3,(item.width*item.height-1)*4+3].map(at=>pixels[at]);
  if(corners.some(alpha=>alpha!==0))throw Error('Normalized furniture corners must remain transparent: '+item.id);
  if(item.mode==='bottom'&&visible.y+visible.height!==item.height)throw Error('Furniture feet did not reach the existing baseline: '+item.id);
  result.push({id:item.id,name:item.name,width:item.width,height:item.height,mode:item.mode,source:item.source,sourceSize:[sw,sh],sourceCrop:[crop.x,crop.y,crop.width,crop.height],placement:rect,...(baselineAdjustment?{baselineAdjustment}:{}),visibleBounds:visible,corners,data:canvas.toDataURL('image/png')});
 }
 return result;
}
async function build(options={}){
 if(options.check&&options.dryRun)throw Error('Choose --check or --dry-run');
 const root=path.resolve(__dirname,'..'),meta=JSON.parse(await fs.readFile(path.join(__dirname,'south-facing-furniture.json'),'utf8')),paths=validateMetadata(meta);
 const inputBuffers=new Map();
 for(const source of paths.inputs){
  try{inputBuffers.set(source,await fs.readFile(path.join(root,source)));}
  catch(error){if(error.code==='ENOENT')throw Error('Furniture source is not ready: '+source);throw error;}
 }
 const environmentScript=await fs.readFile(path.join(root,'environment-art.js'));
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost').pathname;
  if(url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>South-facing furniture builder</title><script src="/environment-art.js"></script>');return;}
  if(url==='/environment-art.js'){res.setHeader('Content-Type','text/javascript');res.end(environmentScript);return;}
  const match=/^\/input\/(\d+)$/.exec(url),source=match&&paths.inputs[Number(match[1])];
  if(source){res.setHeader('Content-Type','image/png');res.end(inputBuffers.get(source));return;}
  if(url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  res.writeHead(404);res.end();
 });
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-south-furniture-'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let serial=1;const jobs=new Map(),listeners=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const job=jobs.get(message.id);if(!job)return;jobs.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);}else listeners.get(message.method)?.(message.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=serial++,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Timed out: '+method));},30000);jobs.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await loaded;
  const config={...meta,sources:paths.inputs},expression=`(${normalize.toString()})(${JSON.stringify(config)},(${alphaBounds.toString()}),(${bottomRect.toString()}))`;
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  const images=result.result.value,items=[];
  for(const image of images){
   const item=meta.items.find(record=>record.id===image.id),outputs=outputPaths(item),buffer=Buffer.from(image.data.split(',')[1],'base64');
   for(const output of outputs){
    if(options.check){let existing;try{existing=await fs.readFile(path.join(root,output));}catch{throw Error('Furniture output is missing: '+output);}if(!existing.equals(buffer))throw Error('Furniture output is stale: '+output);}
    else if(!options.dryRun){await fs.mkdir(path.dirname(path.join(root,output)),{recursive:true});await fs.writeFile(path.join(root,output),buffer);}
   }
   const {data,...record}=image;items.push({...record,outputs,sha256:createHash('sha256').update(buffer).digest('hex')});
  }
  const report={version:1,alphaThreshold:meta.alphaThreshold,sources:paths.inputs.map(source=>({path:source,sha256:createHash('sha256').update(inputBuffers.get(source)).digest('hex')})),items},contents=JSON.stringify(report,null,2)+'\n';
  if(options.check){let existing;try{existing=await fs.readFile(path.join(root,meta.manifest),'utf8');}catch{throw Error('Furniture manifest is missing: '+meta.manifest);}if(existing!==contents)throw Error('Furniture manifest is stale');}
  else if(!options.dryRun){await fs.mkdir(path.dirname(path.join(root,meta.manifest)),{recursive:true});await fs.writeFile(path.join(root,meta.manifest),contents);}
  process.stdout.write(JSON.stringify({mode:options.check?'check':options.dryRun?'dry-run':'write',...report})+'\n');return report;
 }finally{socket?.close();browser.kill('SIGTERM');server.close();if(browser.exitCode===null)await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(require.main===module){
 const args=process.argv.slice(2);if(args.some(arg=>!['--dry-run','--check'].includes(arg))){process.stderr.write('Use --dry-run or --check\n');process.exitCode=1;}
 else build({dryRun:args.includes('--dry-run'),check:args.includes('--check')}).catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
}
module.exports={alphaBounds,bottomRect,outputPaths,validateMetadata,build};
