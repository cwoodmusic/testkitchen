/* Stitch the image-generated repairs into the original pixel grid, then reskin
 * contaminated foreground pixels without moving any atlas coordinates. */
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {spawn}=require('node:child_process');

async function main(){
  if(!process.argv[2])throw Error('Usage: node scripts/build-clean-world.cjs /path/to/generated-empty-room.png');
  const root=path.resolve(__dirname,'..'),plate=path.resolve(process.argv[2]);
  const regions=JSON.parse(await fs.readFile(path.join(__dirname,'clean-world-regions.json'),'utf8'));
  const html=await fs.readFile(path.join(root,'world-preview.html'),'utf8');
  const parts=JSON.parse(html.match(/const foregroundParts=(\[.*?\]);/s)[1]);
  for(const match of html.matchAll(/foregroundParts\.push\(\.\.\.(\[.*?\])\);/g))parts.push(...JSON.parse(match[1]));
  const files={'/original':path.join(root,'coda_arcade_phase86_approved_world.png'),'/plate':plate,'/foreground':path.join(root,'coda_arcade_phase892_foreground.png')};
  const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Clean background builder</title>');return;}if(!files[req.url]){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','image/png');res.end(await fs.readFile(files[req.url]));}catch(err){res.writeHead(500);res.end(err.message);}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-art-builder-'));
  const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  let socket;
  try{
    let port;
    for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
    if(!port)throw Error('Chromium did not start.');
    const pages=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    let nextId=1;const pending=new Map(),listeners=new Map();
    socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const job=pending.get(msg.id);if(!job)return;pending.delete(msg.id);clearTimeout(job.timer);msg.error?job.reject(Error(msg.error.message)):job.resolve(msg.result);}else listeners.get(msg.method)?.(msg.params);});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=nextId++,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out: '+method));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
    await send('Page.enable');const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));
    await send('Page.navigate',{url:base});await loaded;
    const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${build.toString()})(${JSON.stringify({regions,parts})})`});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    const data=result.result.value;
    for(const [key,file]of [['world','coda_arcade_world_clean.png'],['foreground','coda_arcade_foreground_clean.png']])await fs.writeFile(path.join(root,file),Buffer.from(data[key].split(',')[1],'base64'));
    console.log(JSON.stringify({regions:regions.regions.length,world:[regions.width,regions.height],foreground:data.atlasSize,alignment:data.alignment},null,2));
  }finally{socket?.close();browser.kill('SIGTERM');server.close();await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true});}
}

async function build({regions,parts}){
  const image=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not load '+src));img.src=src;});
  const [original,plate,foreground]=await Promise.all(['/original','/plate','/foreground'].map(image));
  const {width:W,height:H,padding,feather}=regions;
  if([original,plate].some(img=>img.naturalWidth!==W||img.naturalHeight!==H))throw Error('Original and repair plate must have identical 1672 × 941 dimensions.');
  const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const old=canvas(W,H),generated=canvas(W,H);old.getContext('2d').drawImage(original,0,0);generated.getContext('2d').drawImage(plate,0,0);
  const originalPixels=old.getContext('2d').getImageData(0,0,W,H).data,platePixels=generated.getContext('2d').getImageData(0,0,W,H).data;
  const boxes=regions.regions.map(region=>{const [x,y,w,h]=region.bounds;return {...region,box:[Math.max(0,x-padding),Math.max(0,y-padding),Math.min(W,x+w+padding),Math.min(H,y+h+padding)]};});
  const insideBox=(x,y)=>boxes.some(({box:b})=>x>=b[0]&&x<b[2]&&y>=b[1]&&y<b[3]);
  const world=canvas(W,H),ctx=world.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(original,0,0);
  const alignment=[];
  for(const region of boxes){
    const [x,y,x2,y2]=region.box,w=x2-x,h=y2-y;
    const samples=[];
    for(let yy=Math.max(2,y-8);yy<Math.min(H-2,y2+8);yy+=2)for(let xx=Math.max(2,x-8);xx<Math.min(W-2,x2+8);xx+=2)if(!insideBox(xx,yy))samples.push([xx,yy]);
    let best={error:Infinity,dx:0,dy:0};
    // Prefer zero offset on ties. Nearby floor lines determine source phase.
    for(const dy of [0,-1,1,-2,2])for(const dx of [0,-1,1,-2,2]){
      let error=0;for(const [xx,yy]of samples){const a=(yy*W+xx)*4,b=((yy+dy)*W+xx+dx)*4;for(let c=0;c<3;c++)error+=Math.abs(originalPixels[a+c]-platePixels[b+c]);}
      if(samples.length&&error<best.error)best={error,dx,dy};
    }
    const patch=canvas(w,h),p=patch.getContext('2d');p.drawImage(plate,x+best.dx,y+best.dy,w,h,0,0,w,h);
    const pixels=p.getImageData(0,0,w,h);
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)pixels.data[(yy*w+xx)*4+3]=Math.round(255*Math.min(1,Math.min(xx,yy,w-1-xx,h-1-yy)/feather));
    p.putImageData(pixels,0,0);ctx.drawImage(patch,x,y);alignment.push({id:region.id,dx:best.dx,dy:best.dy});
  }
  const clean=ctx.getImageData(0,0,W,H).data,atlas=canvas(foreground.naturalWidth,foreground.naturalHeight),a=atlas.getContext('2d');a.drawImage(foreground,0,0);
  // Head silhouettes above solid furniture must become transparent, not floating floor masks.
  const trims={boutique_counter:[487,357,64,61],main_counter:[1320,435,64,30],dance_dj_console:[364,580,64,41]};
  for(const part of parts){
    const [x,y,w,h]=part.bounds,[sx,sy,sw,sh]=part.atlas;
    if(sw!==w||sh!==h)throw Error('Unexpected foreground scale for '+part.name);
    if(!boxes.some(({box:b})=>x<b[2]&&x+w>b[0]&&y<b[3]&&y+h>b[1]))continue;
    const tile=a.getImageData(sx,sy,w,h),trim=trims[part.name];
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const wx=x+xx,wy=y+yy,i=(yy*w+xx)*4;if(!tile.data[i+3]||!insideBox(wx,wy))continue;
      if(trim&&wx>=trim[0]&&wx<trim[0]+trim[2]&&wy>=trim[1]&&wy<trim[1]+trim[3]){tile.data[i+3]=0;continue;}
      const src=(wy*W+wx)*4;tile.data[i]=clean[src];tile.data[i+1]=clean[src+1];tile.data[i+2]=clean[src+2];
    }
    a.putImageData(tile,sx,sy);
  }
  return {world:world.toDataURL('image/png'),foreground:atlas.toDataURL('image/png'),atlasSize:[atlas.width,atlas.height],alignment};
}
main().catch(error=>{console.error(error);process.exitCode=1;});
