/* Slice the generated transparent sprite sheets; retain their source artwork. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),os=require('node:os'),{spawn}=require('node:child_process');
const parts=[
 ['lounge-couch','furniture-plants',[0,0,1090,793]],['table','furniture-plants',[1090,0,420,793]],['palm','furniture-plants',[1510,0,473,793]],
 ['dance-couch-left','fixtures',[0,0,440,445]],['dance-couch-right','fixtures',[440,0,380,445]],['boutique-counter','fixtures',[820,0,350,445]],['main-counter','fixtures',[1170,0,604,445]],
 ['dj-console','fixtures',[0,445,540,442]],['mirror','fixtures',[540,445,360,442]],['speaker','fixtures',[920,445,400,442]],['bollard','fixtures',[1380,445,394,442]]
];
async function main(){
 const root=path.resolve(__dirname,'..'),output=path.join(root,'assets/environment/v1'),profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-environment-build-'));
 const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Environment sprite builder</title>');return;}const name=req.url.slice(1);if(!['furniture-plants','fixtures'].includes(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','image/png');res.end(await fs.readFile(path.join(root,'assets/environment/source',name+'.png')));}catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start.');const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});let nextId=1;const jobs=new Map(),listeners=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const job=jobs.get(message.id);if(!job)return;jobs.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);}else listeners.get(message.method)?.(message.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=nextId++,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Timed out: '+method));},30000);jobs.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:base});await loaded;
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${slice.toString()})(${JSON.stringify(parts)})`});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  await fs.mkdir(output,{recursive:true});const manifest=[];for(const item of result.result.value){await fs.writeFile(path.join(output,item.name+'.png'),Buffer.from(item.data.split(',')[1],'base64'));manifest.push({name:item.name,source:item.source,cell:item.cell,crop:item.crop,width:item.width,height:item.height});}
  await fs.writeFile(path.join(output,'sprite-sources.json'),JSON.stringify(manifest,null,2)+'\n');process.stdout.write(JSON.stringify(manifest,null,2)+'\n');
 }finally{socket?.close();browser.kill('SIGTERM');server.close();if(browser.exitCode===null)await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true});}
}
async function slice(parts){
 const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load '+src));image.src=src;});const sheets={};for(const name of new Set(parts.map(part=>part[1])))sheets[name]=await load('/'+name);
 const result=[];for(const [name,source,cell]of parts){const [x,y,w,h]=cell,image=sheets[source],canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,x,y,w,h,0,0,w,h);const data=context.getImageData(0,0,w,h).data;let left=w,top=h,right=-1,bottom=-1;
  // Ignore isolated near-invisible sheet noise when finding the sprite frame;
  // copy all original RGBA pixels inside that frame without repainting them.
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(data[(yy*w+xx)*4+3]>=32){left=Math.min(left,xx);top=Math.min(top,yy);right=Math.max(right,xx);bottom=Math.max(bottom,yy);}
  if(right<left)throw Error('Empty sprite cell: '+name);left=Math.max(0,left-3);top=Math.max(0,top-3);right=Math.min(w-1,right+3);bottom=Math.min(h-1,bottom+3);const out=document.createElement('canvas');out.width=right-left+1;out.height=bottom-top+1;out.getContext('2d').drawImage(canvas,left,top,out.width,out.height,0,0,out.width,out.height);result.push({name,source,cell,crop:[x+left,y+top,out.width,out.height],width:out.width,height:out.height,data:out.toDataURL('image/png')});
 }return result;
}
main().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
