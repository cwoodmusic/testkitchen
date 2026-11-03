/* Extract 40 decor props and the DJ light fixture from generated transparent source art. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),os=require('node:os'),{spawn}=require('node:child_process');
const sheets=[
 {source:'decor-01',ids:['neon-jukebox','rocket-statue','gumball-machine','star-pedestal','mini-cabinet','cube-lamp','succulent','vinyl-headphones'],groups:['floor','floor','floor','floor','tabletop','tabletop','tabletop','tabletop']},
 {source:'decor-02',ids:['alien-statue','prize-capsule-machine','record-pedestal','neon-cactus','arcade-trophy-pedestal','neon-arrow-sign','planet-sculpture','pixel-heart-totem'],groups:Array(8).fill('floor')},
 {source:'decor-03',ids:['ticket-dispenser','prize-display','checker-flag-stand','boombox-tower','soda-cup','popcorn-tub','token-jar','mini-rocket'],groups:['floor','floor','floor','floor','tabletop','tabletop','tabletop','tabletop']},
 {source:'decor-04',ids:['plasma-orb','trophy','gamepad','headphone-stand','boombox','stacked-cassettes','desk-mushroom-lamp','lucky-cat'],groups:Array(8).fill('tabletop')},
 {source:'decor-05',ids:['neon-game-over-sign','neon-high-score-sign','neon-space-invader','neon-lightning-bolt','neon-music-note','wall-vinyl-record','neon-rainbow','neon-controller-sign'],groups:Array(8).fill('wall')}
];
const fixture='dj-flood-rig';
async function main(){
 const root=path.resolve(__dirname,'..'),output=path.join(root,'assets/decor/v1'),profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-decor-build-'));
 const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Decor sprite builder</title>');return;}const name=req.url.slice(1);if(![...sheets.map(sheet=>sheet.source),fixture].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','image/png');res.end(await fs.readFile(path.join(root,'assets/decor/source',name+'.png')));}catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start.');const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});let nextId=1;const jobs=new Map(),listeners=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const job=jobs.get(message.id);if(!job)return;jobs.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);}else listeners.get(message.method)?.(message.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=nextId++,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Timed out: '+method));},30000);jobs.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:base});await loaded;
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${slice.toString()})(${JSON.stringify(sheets)})`});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  await fs.mkdir(output,{recursive:true});const manifest=[];for(const item of result.result.value){await fs.writeFile(path.join(output,item.name+'.png'),Buffer.from(item.data.split(',')[1],'base64'));manifest.push({name:item.name,source:item.source,group:item.group,cell:item.cell,crop:item.crop,width:item.width,height:item.height,...(item.emitters?{emitters:item.emitters}:{})});}
  await fs.writeFile(path.join(output,'sprite-sources.json'),JSON.stringify(manifest,null,2)+'\n');process.stdout.write(JSON.stringify(manifest,null,2)+'\n');
 }finally{socket?.close();browser.kill('SIGTERM');server.close();if(browser.exitCode===null)await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true});}
}
async function slice(sheets){
 const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load '+src));image.src=src;});
 const result=[];
 function imageData(image){const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);return {canvas,context,data:context.getImageData(0,0,canvas.width,canvas.height).data};}
 // Locate a real transparent gutter near each requested grid divider. Generated
 // sheets have deliberate gutters but their two rows need not be equal heights.
 function gutter(counts,expected,radius){
  const runs=[];let start=null;
  for(let index=0;index<=counts.length;index++){
   if(index<counts.length&&counts[index]===0){if(start===null)start=index;}
   else if(start!==null){if(index-start>=4)runs.push([start,index]);start=null;}
  }
  const candidates=runs.filter(([left,right])=>right>expected-radius&&left<expected+radius);
  candidates.sort((a,b)=>Math.abs((a[0]+a[1])/2-expected)-Math.abs((b[0]+b[1])/2-expected));
  if(!candidates.length)throw Error('Missing transparent sprite gutter near '+expected);
  return Math.floor((candidates[0][0]+candidates[0][1])/2);
 }
 function crop(name,source,group,image,cell){
  const [x,y,w,h]=cell,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,x,y,w,h,0,0,w,h);const data=context.getImageData(0,0,w,h).data;let left=w,top=h,right=-1,bottom=-1;
  // Find the substantial alpha silhouette, then retain original RGBA pixels
  // including a three-pixel transparent margin. No pixel artwork is repainted.
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(data[(yy*w+xx)*4+3]>=32){left=Math.min(left,xx);top=Math.min(top,yy);right=Math.max(right,xx);bottom=Math.max(bottom,yy);}
  if(right<left)throw Error('Empty sprite cell: '+name);left=Math.max(0,left-3);top=Math.max(0,top-3);right=Math.min(w-1,right+3);bottom=Math.min(h-1,bottom+3);
  const out=document.createElement('canvas');out.width=right-left+1;out.height=bottom-top+1;const output=out.getContext('2d',{willReadFrequently:true});output.drawImage(canvas,left,top,out.width,out.height,0,0,out.width,out.height);
  const item={name,source,group,cell,crop:[x+left,y+top,out.width,out.height],width:out.width,height:out.height,data:out.toDataURL('image/png')};
  if(group==='fixture'){
   const rgba=output.getImageData(0,0,out.width,out.height).data;item.emitters=[];
   for(let index=0;index<4;index++){
    let count=0,sumX=0,sumY=0;
    for(let yy=Math.floor(out.height/2);yy<out.height;yy++)for(let xx=Math.floor(index*out.width/4);xx<Math.floor((index+1)*out.width/4);xx++){
     const at=(yy*out.width+xx)*4,r=rgba[at],g=rgba[at+1],b=rgba[at+2];if(rgba[at+3]>128&&g>170&&b>170&&g>r*1.5&&b>r*1.5){count++;sumX+=xx;sumY+=yy;}
    }
    if(!count)throw Error('Missing floodlight LED face '+index);item.emitters.push([Number((sumX/count/out.width).toFixed(6)),Number((sumY/count/out.height).toFixed(6))]);
   }
  }
  return item;
 }
 for(const sheet of sheets){
  const image=await load('/'+sheet.source),{canvas,data}=imageData(image),w=canvas.width,h=canvas.height,rows=new Uint32Array(h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>=32)rows[y]++;
  const ys=[0,gutter(rows,h/2,h*.2),h];
  for(let row=0;row<2;row++){
   const columns=new Uint32Array(w);for(let y=ys[row];y<ys[row+1];y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>=32)columns[x]++;
   const xs=[0,...[1,2,3].map(index=>gutter(columns,w*index/4,w*.1)),w];
   if(xs.some((value,index)=>index&&value<=xs[index-1]))throw Error('Overlapping grid columns: '+sheet.source);
   for(let column=0;column<4;column++){const index=row*4+column;result.push(crop(sheet.ids[index],sheet.source,sheet.groups[index],image,[xs[column],ys[row],xs[column+1]-xs[column],ys[row+1]-ys[row]]));}
  }
 }
 const rig=await load('/dj-flood-rig');result.push(crop('dj-flood-rig','dj-flood-rig','fixture',rig,[0,0,rig.naturalWidth,rig.naturalHeight]));
 return result;
}
main().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
