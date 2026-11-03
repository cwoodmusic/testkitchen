/* Copy generated matte green tabletop pixels without changing trim or alpha.
 * Only the Notes-counter library variant is normalized; other furniture stays raw. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process'),{createHash}=require('node:crypto');
const png=require('./rgba-png.cjs'),meta=require('./main-counter-matte-regions.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function inside(polygon,x,y){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function topMask(before,value=meta){
 const [width,height]=value.size;if(before.width!==width||before.height!==height)throw Error('Counter dimensions changed');
 const mask=new Uint8Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(!value.polygons.some(polygon=>inside(polygon,x+.5,y+.5)))continue;
  const at=(y*width+x)*4,[r,g,b,a]=before.data.subarray(at,at+4);
  // The immutable source's jade/cyan face owns the mask. Warm gold trim,
  // black edge pixels and any transparent outline never receive new art.
  if(a&&g>r&&g>=b)mask[y*width+x]=1;
 }
 return mask;
}
function compose(before,source,value=meta){
 if(Math.abs(source.width/source.height-before.width/before.height)>.025)throw Error('Generated counter source must retain the original aspect ratio');
 const mask=topMask(before,value),data=Buffer.from(before.data);let allowed=0,changed=0;
 for(let y=0;y<before.height;y++)for(let x=0;x<before.width;x++)if(mask[y*before.width+x]){
  allowed++;const at=(y*before.width+x)*4,sx=Math.min(source.width-1,Math.floor((x+.5)*source.width/before.width)),sy=Math.min(source.height-1,Math.floor((y+.5)*source.height/before.height)),from=(sy*source.width+sx)*4;
  if(source.data[from+3]<128)throw Error('Generated tabletop has a transparent hole at '+x+','+y);
  if([0,1,2].some(channel=>data[at+channel]!==source.data[from+channel]))changed++;
  for(let channel=0;channel<3;channel++)data[at+channel]=source.data[from+channel];
 }
 return {width:before.width,height:before.height,data,mask,allowed,changed};
}
async function normalizeLibrary(bytes,item){
 const root=path.resolve(__dirname,'..'),environment=await fs.readFile(path.join(root,'environment-art.js'));
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Matte counter library normalization</title><script src="/environment-art.js"></script>');return;}
  if(req.url==='/environment-art.js'){res.setHeader('Content-Type','text/javascript');res.end(environment);return;}
  if(req.url==='/counter.png'){res.setHeader('Content-Type','image/png');res.end(bytes);return;}
  res.writeHead(req.url==='/favicon.ico'?204:404);res.end();
 });
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-counter-matte-'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start');const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let serial=1;const jobs=new Map(),listeners=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const job=jobs.get(message.id);if(!job)return;jobs.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);}else listeners.get(message.method)?.(message.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=serial++,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Timed out: '+method));},30000);jobs.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await loaded;
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async item=>{const image=new Image();image.src='/counter.png';await image.decode();const c=document.createElement('canvas');c.width=item.width;c.height=item.height;const g=c.getContext('2d');g.imageSmoothingEnabled=false;const rect=CodaEnvironmentArt.fitRect(image.naturalWidth,image.naturalHeight,item.width,item.height);g.drawImage(image,rect.x,rect.y,rect.width,rect.height);return c.toDataURL('image/png');})(${JSON.stringify(item)})`});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return Buffer.from(result.result.value.split(',')[1],'base64');
 }finally{socket?.close();browser.kill('SIGTERM');server.close();if(browser.exitCode===null)await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
function furnitureManifest(before,nativeBytes,libraryBytes,value=meta){
 const report=structuredClone(before),item=report.items.find(record=>record.id==='counter-jade-south'),source=report.sources.find(record=>record.path===value.output);
 if(!item||!source||item.outputs.length!==1||item.outputs[0]!==value.libraryOutput)throw Error('Counter furniture provenance is unavailable');
 source.sha256=sha(nativeBytes);item.sha256=sha(libraryBytes);return report;
}
async function build(options={}){
 if(options.check&&options.dryRun)throw Error('Choose --check or --dry-run');
 const root=path.resolve(__dirname,'..'),read=file=>fs.readFile(path.join(root,file)),beforeBytes=await read(meta.before),sourceBytes=await read(meta.source),projectBefore=await read('published-world-project.json');
 const result=compose(png.decode(beforeBytes),png.decode(sourceBytes)),nativeBytes=png.encode(result),oldManifest=JSON.parse(await read(meta.furnitureManifestBefore)),item=oldManifest.items.find(record=>record.id==='counter-jade-south'),libraryBytes=await normalizeLibrary(nativeBytes,item);
 const manifest=furnitureManifest(oldManifest,nativeBytes,libraryBytes),contents=JSON.stringify(manifest,null,2)+'\n';
 for(const[file,bytes]of [[meta.output,nativeBytes],[meta.libraryOutput,libraryBytes],[meta.furnitureManifest,Buffer.from(contents)]]){
  if(options.check){if(!(await read(file)).equals(bytes))throw Error('Matte counter output is stale: '+file);}
  else if(!options.dryRun)await fs.writeFile(path.join(root,file),bytes);
 }
 if(!(await read('published-world-project.json')).equals(projectBefore))throw Error('Counter finishing changed the user project');
 const report={mode:options.check?'check':options.dryRun?'preview':'write',allowed:result.allowed,changed:result.changed,nativeSha256:sha(nativeBytes),librarySha256:sha(libraryBytes),projectUnchanged:true};process.stdout.write(JSON.stringify(report)+'\n');return report;
}
if(require.main===module)build({check:process.argv.includes('--check'),dryRun:process.argv.includes('--dry-run')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={inside,topMask,compose,furnitureManifest,normalizeLibrary,build};
