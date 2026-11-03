/* Slice generated rug art without repainting pixels or touching other decor. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),os=require('node:os'),{spawn}=require('node:child_process');
const rugs=[['rug-notes-rectangle',360,112],['rug-neon-oval',160,100],['rug-pixel-round',120,120],['rug-checker-square',120,120],['rug-lightning-runner',280,90],['rug-starburst',140,140],['rug-controller',160,105],['rug-hex-grid',130,125]];
async function main(){
 const root=path.resolve(__dirname,'..'),output=path.join(root,'assets/decor/v1'),profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-rug-build-'));
 const sources=['rugs-01','rug-notes-rectangle-source'];
 const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Rug sprite builder</title>');return;}const source=req.url.slice(1);if(!sources.includes(source)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','image/png');res.end(await fs.readFile(path.join(root,'assets/decor/source',source+'.png')));}catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start.');const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});let serial=1;const jobs=new Map(),listeners=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const job=jobs.get(message.id);if(!job)return;jobs.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);}else listeners.get(message.method)?.(message.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=serial++,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Timed out: '+method));},30000);jobs.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:base});await loaded;
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${slice.toString()})(${JSON.stringify(rugs)})`});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  await fs.mkdir(output,{recursive:true});const manifest=[];
  for(const item of result.result.value){await fs.writeFile(path.join(output,item.name+'.png'),Buffer.from(item.data.split(',')[1],'base64'));const {data,...record}=item;manifest.push(record);}
  await fs.writeFile(path.join(output,'rug-sources.json'),JSON.stringify(manifest,null,2)+'\n');process.stdout.write(JSON.stringify(manifest,null,2)+'\n');
 }finally{socket?.close();browser.kill('SIGTERM');server.close();if(browser.exitCode===null)await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true});}
}
async function slice(rugs){
 const load=source=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load '+source));image.src='/'+source;});
 function pixels(image){const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);return {canvas,data:ctx.getImageData(0,0,canvas.width,canvas.height).data};}
 function gutter(counts,expected,radius){
  const runs=[];let first=null;
  for(let index=0;index<=counts.length;index++)if(index<counts.length&&counts[index]===0){if(first===null)first=index;}else if(first!==null){if(index-first>=4)runs.push([first,index]);first=null;}
  const candidates=runs.filter(([a,b])=>b>expected-radius&&a<expected+radius).sort((a,b)=>Math.abs((a[0]+a[1])/2-expected)-Math.abs((b[0]+b[1])/2-expected));
  if(!candidates.length)throw Error('Missing transparent gutter near '+expected);return Math.floor((candidates[0][0]+candidates[0][1])/2);
 }
 function crop(record,source,image,cell){
  const [name,worldWidth,worldHeight]=record,[x,y,w,h]=cell,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,x,y,w,h,0,0,w,h);
  const rgba=ctx.getImageData(0,0,w,h).data;let left=w,top=h,right=-1,bottom=-1,substantialPixels=0;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(rgba[(yy*w+xx)*4+3]>=32){left=Math.min(left,xx);top=Math.min(top,yy);right=Math.max(right,xx);bottom=Math.max(bottom,yy);substantialPixels++;}
  if(right<left)throw Error('Empty rug: '+name);left=Math.max(0,left-3);top=Math.max(0,top-3);right=Math.min(w-1,right+3);bottom=Math.min(h-1,bottom+3);
  const sourceCrop=[x+left,y+top,right-left+1,bottom-top+1],out=document.createElement('canvas');out.width=sourceCrop[2];out.height=sourceCrop[3];const output=out.getContext('2d',{willReadFrequently:true});output.drawImage(canvas,left,top,out.width,out.height,0,0,out.width,out.height);
  let texture=out,outputScale=1,outputPadding=0;
  if(name==='rug-notes-rectangle'&&out.width>960){
   // Compile a texture above 2.6x its default world width. Retain the original
   // generated source and use nearest-neighbour sampling, then add a fresh
   // transparent border so placement/export stays compact and edges stay clear.
   outputPadding=3;const width=960-outputPadding*2,height=Math.round(out.height*width/out.width);outputScale=width/out.width;
   texture=document.createElement('canvas');texture.width=width+outputPadding*2;texture.height=height+outputPadding*2;
   const scaled=texture.getContext('2d',{willReadFrequently:true});scaled.imageSmoothingEnabled=false;scaled.drawImage(out,0,0,out.width,out.height,outputPadding,outputPadding,width,height);
  }
  const result=texture.getContext('2d',{willReadFrequently:true}).getImageData(0,0,texture.width,texture.height).data,corners=[3,(texture.width-1)*4+3,((texture.height-1)*texture.width)*4+3,(texture.width*texture.height-1)*4+3].map(index=>result[index]);
  if(corners.some(alpha=>alpha!==0))throw Error('Rug corners are not transparent: '+name);
  const compiled=texture!==out?{sourceCrop,outputScale,outputPadding,productionSubstantialPixels:result.reduce((total,value,index)=>total+(index%4===3&&value>=32?1:0),0)}:{};
  return {name,source,cell,crop:sourceCrop,width:texture.width,height:texture.height,worldWidth,worldHeight,substantialPixels,corners,...compiled,data:texture.toDataURL('image/png')};
 }
 const image=await load('rugs-01'),{canvas,data}=pixels(image),w=canvas.width,h=canvas.height,rows=new Uint32Array(h),result=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>=32)rows[y]++;
 const ys=[0,gutter(rows,h/2,h*.2),h];
 for(let row=0;row<2;row++){
  const columns=new Uint32Array(w);for(let y=ys[row];y<ys[row+1];y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>=32)columns[x]++;
  const xs=[0,...[1,2,3].map(index=>gutter(columns,w*index/4,w*.1)),w];if(xs.some((value,index)=>index&&value<=xs[index-1]))throw Error('Overlapping rug cells.');
  for(let col=0;col<4;col++){const index=row*4+col;if(index===0)continue;result.push(crop(rugs[index],'rugs-01',image,[xs[col],ys[row],xs[col+1]-xs[col],ys[row+1]-ys[row]]));}
 }
 const notes=await load('rug-notes-rectangle-source');result.unshift(crop(rugs[0],'rug-notes-rectangle-source',notes,[0,0,notes.naturalWidth,notes.naturalHeight]));return result;
}
main().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
