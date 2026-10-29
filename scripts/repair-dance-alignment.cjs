/* Scoped compositor for the image-generated dance-room alignment repair.
 * The generated PNG supplies upholstery and grout/detail textures. UV remapping
 * fits them to the existing sofa mask and surviving native grout; a baked
 * world-space light envelope keeps reflected illumination from repeating.
 * Baked lighting values make repeated runs pixel-identical. No layout changes.
 */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');

async function compose(meta){
 const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load '+src));image.src=src;});
 const [original,foreground,source]=await Promise.all(['/world','/foreground','/source'].map(load));
 const [width,height]=meta.worldSize;
 if(original.naturalWidth!==width||original.naturalHeight!==height||source.naturalWidth!==meta.sourceSize[0]||source.naturalHeight!==meta.sourceSize[1])throw Error('Unexpected repair dimensions');
 const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
 const wc=make(width,height),wg=wc.getContext('2d',{willReadFrequently:true});wg.drawImage(original,0,0);const world=wg.getImageData(0,0,width,height);
 const ac=make(foreground.naturalWidth,foreground.naturalHeight),ag=ac.getContext('2d',{willReadFrequently:true});ag.drawImage(foreground,0,0);const atlas=ag.getImageData(0,0,ac.width,ac.height);
 const sc=make(source.naturalWidth,source.naturalHeight),sg=sc.getContext('2d',{willReadFrequently:true});sg.drawImage(source,0,0);const pixels=sg.getImageData(0,0,sc.width,sc.height).data;
 const sample=(x,y)=>{x=Math.max(0,Math.min(sc.width-1,Math.round(x)));y=Math.max(0,Math.min(sc.height-1,Math.round(y)));return (y*sc.width+x)*4;};
 const inside=(p,x,y)=>{let result=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
 const excluded=(x,y)=>meta.floorExclusions.some(part=>{const [bx,by,bw,bh]=part.bounds,[ax,ay]=part.atlas;return x>=bx&&x<bx+bw&&y>=by&&y<by+bh&&atlas.data[((ay+y-by)*ac.width+ax+x-bx)*4+3]>0;});
 const floorAllowed=(x,y)=>meta.floorPolygons.some(p=>inside(p,x+.5,y+.5))&&!excluded(x,y);
 const grid=meta.floorGrid,interval=(a,v)=>{let i=0;while(i<a.length-2&&v>=a[i+1])i++;return [i,Math.max(0,Math.min(1,(v-a[i])/(a[i+1]-a[i])))];};
 const floorSample=(x,y)=>{const [ix,tx]=interval(grid.x,x),[iy,ty]=interval(grid.y,y),sx=ix%(grid.sourceX.length-1),sy=iy%(grid.sourceY.length-1);return sample(grid.sourceX[sx]+tx*(grid.sourceX[sx+1]-grid.sourceX[sx]),grid.sourceY[sy]+ty*(grid.sourceY[sy+1]-grid.sourceY[sy]));};
 let lighting=meta.floorLighting;
 if(!lighting){
  const step=6,ox=618,oy=675,cols=16,rows=19,values=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const sums=[0,0,0];let n=0;
   for(let dy=-9;dy<=9;dy++)for(let dx=-9;dx<=9;dx++){
    const x=Math.round(ox+i*step+dx),y=Math.round(oy+j*step+dy);if(!floorAllowed(x,y))continue;
    const at=(y*width+x)*4;for(let c=0;c<3;c++)sums[c]+=world.data[at+c];n++;
   }
   for(let c=0;c<3;c++)values.push(n?Math.round(sums[c]/n*10)/10:0);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const at=(j*cols+i)*3;if(values[at]||values[at+1]||values[at+2])continue;let nearest=-1,distance=Infinity;for(let n=0;n<cols*rows;n++){if(!values[n*3]&&!values[n*3+1]&&!values[n*3+2])continue;const d=(n%cols-i)**2+(Math.floor(n/cols)-j)**2;if(d<distance){distance=d;nearest=n;}}if(nearest>=0)for(let c=0;c<3;c++)values[at+c]=values[nearest*3+c];}
  lighting={origin:[ox,oy],step,cols,rows,values,mode:'absolute-world-lighting'};
 }
 const offset=(x,y,c)=>{const {origin:[ox,oy],step,cols,rows,values}=lighting,fx=Math.max(0,Math.min(cols-1,(x-ox)/step)),fy=Math.max(0,Math.min(rows-1,(y-oy)/step)),ix=Math.min(cols-2,Math.floor(fx)),iy=Math.min(rows-2,Math.floor(fy)),tx=fx-ix,ty=fy-iy,at=(iy*cols+ix)*3+c;return (values[at]*(1-tx)+values[at+3]*tx)*(1-ty)+(values[at+cols*3]*(1-tx)+values[at+cols*3+3]*tx)*ty;};
 let floorPixels=0,couchPixels=0;
 for(let y=675;y<778;y++)for(let x=618;x<708;x++)if(floorAllowed(x,y)){
  const at=(y*width+x)*4,s=floorSample(x,y),[ix,tx]=interval(grid.x,x),[iy,ty]=interval(grid.y,y),sx=ix%(grid.sourceX.length-1),sy=iy%(grid.sourceY.length-1),center=sample((grid.sourceX[sx]+grid.sourceX[sx+1])*.5,(grid.sourceY[sy]+grid.sourceY[sy+1])*.5);
  const edge=Math.min(...grid.x.map(v=>Math.abs(v-x)),...grid.y.map(v=>Math.abs(v-y)))<.6;
  const sourceLuma=(pixels[s]+pixels[s+1]+pixels[s+2])/3,centerLuma=(pixels[center]+pixels[center+1]+pixels[center+2])/3,shade=edge?Math.max(.42,Math.min(.72,sourceLuma/Math.max(1,centerLuma))):1;
  for(let c=0;c<3;c++)world.data[at+c]=Math.max(0,Math.min(255,Math.round(offset(x,y,c)*shade+(edge?0:Math.max(-3,Math.min(3,(pixels[s+c]-pixels[center+c])*.06))))));floorPixels++;
 }
 const poly=meta.couchPolygon;
 const [bx,by,bw,bh]=meta.foreground.bounds,[ax,ay]=meta.foreground.atlas;
 let couchPaintRuns=meta.couchPaintRuns;
 if(!couchPaintRuns){
  const upholstery=(x,y)=>{if(x<bx||x>=bx+bw||y<by||y>=by+bh)return false;const at=(y*width+x)*4,r=world.data[at],g=world.data[at+1],b=world.data[at+2];return r>105&&r>g*1.2&&r>b*.8;};
  couchPaintRuns=[];
  for(let y=by;y<by+bh;y++){let start=null;for(let x=bx;x<=bx+bw;x++){
   let allowed=x<bx+bw&&inside(poly,x+.5,y+.5);
   if(allowed){allowed=false;for(let dy=-2;dy<=2&&!allowed;dy++)for(let dx=-2;dx<=2;dx++)if(upholstery(x+dx,y+dy)){allowed=true;break;}}
   if(allowed&&start===null)start=x;
   if(!allowed&&start!==null){couchPaintRuns.push([y,start,x]);start=null;}
  }}
 }
 const [cx,cy,cw,ch]=meta.targetCrop;
 for(const [y,x0,x1]of couchPaintRuns)for(let x=x0;x<x1;x++){
  const at=(y*width+x)*4,tile=((ay+y-by)*ac.width+ax+x-bx)*4;if(!atlas.data[tile+3])continue;
  const s=sample((x-cx)*sc.width/cw,(y-cy)*sc.height/ch);
  // The registered source has new floor below its base. Never copy that blue
  // ground into a movable cushion; the existing dark base remains untouched.
  if(pixels[s]<pixels[s+2]*.62)continue;
  for(let c=0;c<3;c++)world.data[at+c]=atlas.data[tile+c]=pixels[s+c];couchPixels++;
 }
 wg.putImageData(world,0,0);ag.putImageData(atlas,0,0);
 return {world:wc.toDataURL('image/png'),foreground:ac.toDataURL('image/png'),floorLighting:lighting,couchPaintRuns,floorPixels,couchPixels,alphaPreserved:true};
}

async function main(){
 const root=path.resolve(__dirname,'..'),meta=JSON.parse(await fs.readFile(path.join(__dirname,'dance-alignment-repair.json'),'utf8'));
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
  const preview=process.argv.includes('--preview');
  for(const [key,file]of [['world',files['/world']],['foreground',files['/foreground']]])await fs.writeFile(preview?path.join('/tmp',key==='world'?'dance-world-preview69.png':'dance-atlas-preview69.png'):path.join(root,file),Buffer.from(data[key].split(',')[1],'base64'));
  const latest=JSON.parse(await fs.readFile(path.join(root,'scripts/dance-alignment-repair.json'),'utf8'));latest.floorLighting=data.floorLighting;latest.couchPaintRuns=data.couchPaintRuns;await fs.writeFile(path.join(root,'scripts/dance-alignment-repair.json'),JSON.stringify(latest,null,2)+'\n');
  console.log(JSON.stringify({couchPixels:data.couchPixels,floorPixels:data.floorPixels,alphaPreserved:data.alphaPreserved,preview:process.argv.includes('--preview')}));
 }finally{socket?.close();const exited=new Promise(resolve=>browser.once('exit',resolve));browser.kill('SIGTERM');server.close();await exited;await fs.rm(profile,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
