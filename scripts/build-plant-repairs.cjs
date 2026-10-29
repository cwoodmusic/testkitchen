/* Stitch the image-generated four-plant clean plate as one continuous surface.
 * Preserve the original neighboring plant and all foreground atlas coordinates. */
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');

async function main(){

  const root=path.resolve(__dirname,'..'),plate=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'assets/world/dance-plant-repair-source.png');
  const regions=JSON.parse(await fs.readFile(path.join(__dirname,'dance-plant-repairs.json'),'utf8'));
  const html=await fs.readFile(path.join(root,'world-preview.html'),'utf8');
  const parts=JSON.parse(html.match(/const foregroundParts=(\[.*?\]);/s)[1]);
  for(const match of html.matchAll(/foregroundParts\.push\(\.\.\.(\[.*?\])\);/g))parts.push(...JSON.parse(match[1]));
  for(const match of html.matchAll(/foregroundParts\.push\((\{"name".*?\})\);/g))parts.push(JSON.parse(match[1]));
  for(const match of html.matchAll(/foregroundParts\.push\((\{name:.*?\})\);/g))parts.push(JSON.parse(match[1].replace(/([{,])(\w+):/g,'$1"$2":')));
  // Pin the already character-cleaned inputs so rebuilding is deterministic
  // even after these output PNGs have been checked in. Optional paths support
  // future source migrations without changing the generated repair plate.
  const readBase=async(name,override)=>override?fs.readFile(path.resolve(override)):(await promisify(execFile)('git',['show',regions.baseRevision+':'+name],{cwd:root,encoding:'buffer',maxBuffer:32*1024*1024})).stdout;
  const [baseWorld,baseForeground]=await Promise.all([readBase('coda_arcade_world_clean.png',process.argv[3]),readBase('coda_arcade_foreground_clean.png',process.argv[4])]);
  const files={'/original':baseWorld,'/plate':plate,'/foreground':baseForeground,'/masks':path.join(root,'coda_arcade_phase892_foreground.png')};
  const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Clean background builder</title>');return;}if(!files[req.url]){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','image/png');res.end(Buffer.isBuffer(files[req.url])?files[req.url]:await fs.readFile(files[req.url]));}catch(err){res.writeHead(500);res.end(err.message);}});
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
    console.log(JSON.stringify({regions:regions.regions.length,world:[1672,941],foreground:data.atlasSize},null,2));
  }finally{socket?.close();browser.kill('SIGTERM');server.close();await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true});}
}

async function build({regions,parts}){
  const image=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not load '+src));img.src=src;});
  const [original,plate,foreground,masks]=await Promise.all(['/original','/plate','/foreground','/masks'].map(image));
  const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const world=canvas(1672,941),g=world.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(original,0,0);
  const [cx,cy,cw,ch]=regions.crop,repair=canvas(cw,ch),r=repair.getContext('2d');
  r.imageSmoothingEnabled=false;r.drawImage(plate,0,0,cw,ch);
  // A continuous clean plate avoids silhouette-shaped seams in the wall and
  // floor. The frame was generated from this exact crop, not the whole world.
  const layer=canvas(cw,ch),l=layer.getContext('2d');l.imageSmoothingEnabled=false;l.drawImage(repair,0,0);
  // The generated plate is an art source, not a new coordinate system.
  // Rephase its corridor grid to the measured original grout intersections.
  // Horizontal rows drift a few pixels over the crop; verticals fan slightly.
  const source=r.getImageData(0,0,cw,ch),warped=l.getImageData(0,0,cw,ch);
  const map=(value,from,to)=>{
    let at=0;while(at<from.length-2&&value>from[at+1])at++;
    const mix=(value-from[at])/(from[at+1]-from[at]);return to[at]+mix*(to[at+1]-to[at]);
  };
  const yTarget=[522,534,547,559,571,583,594,606,620,632,644,656,668,680,691,703,714];
  const ySource=[521,533,546,558,570,581,592,603,614,626,639,651,663,675,686,697,708];
  for(let wy=532;wy<cy+ch;wy++)for(let wx=788;wx<834;wx++){
    const drift=Math.max(0,Math.min(1,(wy-520)/80)),tail=Math.max(0,Math.min(1,(wy-600)/110));
    const target=[788,798+3*drift+tail,811+3*drift,824+2*drift,834];
    const sourceX=map(wx,target,[788,796,809,825,834]),sourceY=map(wy,yTarget,ySource);
    const sx=Math.max(0,Math.min(cw-1,Math.round(sourceX-cx))),sy=Math.max(0,Math.min(ch-1,Math.round(sourceY-cy)));
    const i=((wy-cy)*cw+wx-cx)*4,si=(sy*cw+sx)*4;
    for(let channel=0;channel<4;channel++)warped.data[i+channel]=source.data[si+channel];
  }
  l.putImageData(warped,0,0);
  const blend=l.getImageData(0,0,cw,ch);
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
    const edge=Math.min(x,y,cw-1-x,ch-1-y);
    blend.data[(y*cw+x)*4+3]=Math.round(255*Math.min(1,edge/regions.feather));
  }
  l.putImageData(blend,0,0);g.drawImage(layer,cx,cy);
  // This fifth palm is cut off below the user's screenshot. Preserve its
  // original silhouette rather than removing it with the four requested ones.
  const keep=parts.find(part=>part.name===regions.preserveForeground);
  if(keep){
    const [x,y,w,h]=keep.bounds,[sx,sy]=keep.atlas,plant=canvas(w,h),p=plant.getContext('2d');
    p.drawImage(masks,sx,sy,w,h,0,0,w,h);p.globalCompositeOperation='source-in';p.drawImage(original,x,y,w,h,0,0,w,h);g.drawImage(plant,x,y);
  }
  const atlas=canvas(foreground.naturalWidth,foreground.naturalHeight),a=atlas.getContext('2d');a.drawImage(foreground,0,0);
  const clean=g.getImageData(0,0,1672,941).data;
  const inside=(x,y)=>x>cx&&x<cx+cw-1&&y>cy&&y<cy+ch-1;
  for(const part of parts){
    const [x,y,w,h]=part.bounds,[sx,sy]=part.atlas;
    if(regions.removedForeground.includes(part.name)){a.clearRect(sx,sy,w,h);continue;}
    if(part.name===regions.preserveForeground)continue;
    if(x>=cx+cw||x+w<=cx||y>=cy+ch||y+h<=cy)continue;
    const tile=a.getImageData(sx,sy,w,h);
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const wx=x+xx,wy=y+yy,i=(yy*w+xx)*4;if(!tile.data[i+3]||!inside(wx,wy))continue;
      const at=(wy*1672+wx)*4;tile.data[i]=clean[at];tile.data[i+1]=clean[at+1];tile.data[i+2]=clean[at+2];
    }
    a.putImageData(tile,sx,sy);
  }
  return {world:world.toDataURL('image/png'),foreground:atlas.toDataURL('image/png'),atlasSize:[atlas.width,atlas.height]};
}
main().catch(error=>{console.error(error);process.exitCode=1;});
