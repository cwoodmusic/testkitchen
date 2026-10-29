/* Bake the redrawn bald base and independent arcade cosmetics into neutral layers.
 * Runtime characters tint, assemble and articulate the compiled pixels. */
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');
async function main(){
 const root=path.resolve(__dirname,'../assets/characters');await fs.mkdir(root,{recursive:true});
 const server=http.createServer(async(req,res)=>{try{
  if(req.method==='POST'&&/^\/output\/[a-z0-9-]+\.png$/.test(req.url)){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);await fs.writeFile(path.join(root,path.basename(req.url)),Buffer.concat(chunks));res.end('ok');return;
  }
  if(req.url==='/base-avatar.png'){res.setHeader('Content-Type','image/png');res.end(await fs.readFile(path.join(root,'source/base-avatar-gray.png')));return;}
  if(req.url==='/original.png'){res.setHeader('Content-Type','image/png');res.end(await fs.readFile(path.resolve(root,'../../coda_arcade_phase73_characters.png')));return;}
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Sprite asset baker</title>');return;}
  res.writeHead(404);res.end();
 }catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-sprite-baker-'));
 const chrome=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start');
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let id=0;const jobs=new Map(),events=new Map();
  socket.addEventListener('message',event=>{const value=JSON.parse(event.data);if(value.id){const job=jobs.get(value.id);if(!job)return;jobs.delete(value.id);clearTimeout(job.timer);value.error?job.reject(Error(value.error.message)):job.resolve(value.result);}else events.get(value.method)?.(value.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id,timer=setTimeout(()=>reject(Error('Timed out: '+method)),120000);jobs.set(requestId,{resolve,reject,timer});socket.send(JSON.stringify({id:requestId,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>events.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:origin});await loaded;
  const result=await send('Runtime.evaluate',{expression:'window.buildOriginalSpriteLayers='+require('./original-sprite-layers.cjs').toString()+';window.buildOriginalWardrobeLayers='+require('./original-wardrobe-layers.cjs').toString()+';window.buildOriginalAccessoryLayers='+require('./original-accessory-layers.cjs').toString()+';window.buildRedrawnBaseLayers='+require('./redrawn-base-layers.cjs').toString()+';('+bake.toString()+')()',awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  const manifest=result.result.value;await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({frames:112,cell:manifest.cell,atlases:manifest.artifacts.length,variants:manifest.layers,source:'Redrawn bald gray avatar with independent original-arcade cosmetics'},null,2));
 }finally{socket?.close();chrome.kill('SIGTERM');server.close();await new Promise(resolve=>chrome.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true});}
}
async function bake(){
 const W=80,H=96,COLS=8,PERDIR=28,anchor=[40,88],directions=['down','left','up','right'];
 const make=(w=W,h=H)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
 const ctx=c=>c.getContext('2d',{willReadFrequently:true});
 const copy=c=>{const out=make(c.width,c.height);ctx(out).drawImage(c,0,0);return out;};
 const original=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Original atlas could not load'));image.src='/original.png';});
 const originalRects={down:[[16,5,47,69],[97,5,45,69],[178,5,44,69],[259,5,42,69],[338,5,44,69]],left:[[816,5,47,69],[896,5,47,69],[16,85,47,69],[96,85,47,69],[176,85,47,69]],up:[[416,6,47,67],[497,6,45,67],[578,6,44,67],[658,6,43,67],[739,6,42,67]],right:[[256,85,47,69],[336,85,47,69],[416,85,47,69],[496,85,47,69],[576,85,47,69]]},heroFrames={};
 for(const direction of directions)originalRects[direction].forEach(([x,y,w,h],index)=>heroFrames['hero_'+direction+'_'+index]={x,y,w,h});
 const head=window.buildOriginalSpriteLayers({atlas:original,cell:[W,H],anchor,heroFrames});
 const wardrobe=Array.from({length:1},(_,frameIndex)=>window.buildOriginalWardrobeLayers({atlas:original,cell:[W,H],anchor,heroFrames,frameIndex}));
 const props=window.buildOriginalAccessoryLayers({atlas:original,cell:[W,H],anchor,heroFrames,headLayers:head});
 const clips={idle:{offset:0,frames:2,fps:2},walk:{offset:2,frames:6,fps:8},wave:{offset:8,frames:4,fps:8},dance:{offset:12,frames:6,fps:8},interact:{offset:18,frames:4,fps:6},talk:{offset:22,frames:4,fps:6},sit:{offset:26,frames:2,fps:2}};
 const redraw=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Redrawn base could not load'));image.src='/base-avatar.png';});
 const base=window.buildRedrawnBaseLayers({atlas:redraw,cell:[W,H],anchor});
 const manifest={version:1,cell:[W,H],anchor,columns:COLS,framesPerDirection:PERDIR,directions,clips,artStyle:'arcade-pixel-redraw',sourcePolicy:'redrawn-base-and-original-cosmetics',targetHeight:53,styleReference:'coda_arcade_phase73_characters.png',baseAvatar:{url:'source/base-avatar-gray.png',...base.metadata},sharedHead:base.metadata,sourceArtwork:['assets/characters/source/base-avatar-gray.png','coda_arcade_phase73_characters.png'],layers:{body:{url:'body.png',layout:'animated',material:'skin',source:'redrawn-base'},hair:{},outfit:{},headwear:{},eyewear:{},accessory:{},shoes:{},original:{hero:{url:'original-hero.png',layout:'animated',material:'none',source:'redrawn-base'}}},frameData:[],artifacts:[]};
 function fitOldCosmetic(native,dir){
  const info=wardrobe[0].metadata.frames[dir],[left,top]=info.placement,height=info.bottom-top+1,width=Math.min(39,53*info.source.w/height),sx=Math.round(width)/info.source.w,sy=53/height;
  const out=make(),g=ctx(out);g.imageSmoothingEnabled=false;g.setTransform(sx,0,0,sy,Math.round(40-width/2)-left*sx,35-top*sy);g.drawImage(native,0,0);return out;
 }
 const mirror=source=>{const out=make(),g=ctx(out);g.translate(W,0);g.scale(-1,1);g.drawImage(source,0,0);return out;};
 manifest.motionRig={version:1,method:'articulated-redrawn-pixels',right:'drawn right view',template:'bald gray neutral',clock:'continuous distance phase'};
 manifest.frameData=Array.from({length:112},()=>({headX:0,headY:0,headScaleX:1,headScaleY:1,bodyX:0,bodyY:0,bodyScaleX:1,bodyScaleY:1,handX:0,handY:0,handScaleX:1,handScaleY:1}));
 async function write(name,canvas){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),response=await fetch('/output/'+name+'.png',{method:'POST',body:blob});if(!response.ok)throw Error('Cannot save '+name);manifest.artifacts.push({file:name+'.png',width:canvas.width,height:canvas.height});}
 async function animated(name,views){const out=make(W*COLS,H*14),g=ctx(out);for(let index=0;index<112;index++)g.drawImage(views[Math.floor(index/PERDIR)],index%COLS*W,Math.floor(index/COLS)*H);await write(name,out);}
 async function directional(name,cells){const out=make(W*4,H),g=ctx(out),views=cells.map(fitOldCosmetic);views[3]=mirror(views[1]);views.forEach((cell,dir)=>g.drawImage(cell,dir*W,0));await write(name,out);}
 await animated('body',base.body);await animated('original-hero',base.original);
 for(const [id,views]of Object.entries(head.hair)){manifest.layers.hair[id]={url:'hair-'+id+'.png',layout:'directional',material:'hair',source:'original-atlas'};await directional('hair-'+id,views);}
 for(const [id,views]of Object.entries(base.outfit)){manifest.layers.outfit[id]={url:'outfit-'+id+'.png',layout:'animated',material:id==='pants'?'gray-clothes':'clothes',...(id==='pants'?{dyeRegions:base.metadata.frames.map(frame=>frame.dyeRegions)}:{}),source:'redrawn-base'};await animated('outfit-'+id,views);}
 for(const [id,views]of Object.entries(base.shoes)){manifest.layers.shoes[id]={url:'shoes-'+id+'.png',layout:'animated',material:'none',source:'redrawn-base'};await animated('shoes-'+id,views);}
 for(const category of ['headwear','eyewear','accessory'])for(const [id,views]of Object.entries(props[category])){manifest.layers[category][id]={url:category+'-'+id+'.png',layout:'directional',material:'none',source:'original-atlas'};await directional(category+'-'+id,views);}

 return manifest;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
