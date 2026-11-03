/* Extract the lounge expansion from generated transparent sprite sheets.
 * Existing decor files and user layouts are never changed by this builder. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process'),{createHash}=require('node:crypto');
const library=require('../decor-library.js'),metadata=require('./lounge-assets.json');

function alphaBounds(data,width,height,threshold=8){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>threshold){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 return right<left?null:[left,top,right-left+1,bottom-top+1];
}
function gridCells(data,width,height,rows,columns,threshold=8){
 function gutter(counts,expected,radius){
  let start=null;const runs=[];
  for(let i=0;i<=counts.length;i++)if(i<counts.length&&counts[i]===0){if(start===null)start=i;}
  else if(start!==null){if(i-start>=4)runs.push([start,i]);start=null;}
  const candidates=runs.filter(([a,b])=>a<=expected+radius&&b>=expected-radius);
  candidates.sort((a,b)=>Math.abs((a[0]+a[1])/2-expected)-Math.abs((b[0]+b[1])/2-expected));
  if(!candidates.length)throw Error('A transparent gutter is required near '+Math.round(expected));
  return Math.floor((candidates[0][0]+candidates[0][1])/2);
 }
 const rowCounts=new Uint32Array(height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>threshold)rowCounts[y]++;
 const ys=[0,...Array.from({length:rows-1},(_,i)=>gutter(rowCounts,height*(i+1)/rows,height*.2)),height],cells=[];
 if(ys.some((value,i)=>i&&value<=ys[i-1]))throw Error('Sprite rows overlap');
 for(let row=0;row<rows;row++){
  const columnCounts=new Uint32Array(width);
  for(let y=ys[row];y<ys[row+1];y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>threshold)columnCounts[x]++;
  const xs=[0,...Array.from({length:columns-1},(_,i)=>gutter(columnCounts,width*(i+1)/columns,width*.12)),width];
  if(xs.some((value,i)=>i&&value<=xs[i-1]))throw Error('Sprite columns overlap');
  for(let column=0;column<columns;column++)cells.push([xs[column],ys[row],xs[column+1]-xs[column],ys[row+1]-ys[row]]);
 }
 return cells;
}
function fitRect(sourceWidth,sourceHeight,width,height,padding=2){
 if(![sourceWidth,sourceHeight,width,height].every(n=>Number.isInteger(n)&&n>0)||width<=padding*2||height<=padding*2)throw Error('Invalid sprite dimensions');
 const scale=Math.min((width-padding*2)/sourceWidth,(height-padding*2)/sourceHeight),w=Math.max(1,Math.round(sourceWidth*scale)),h=Math.max(1,Math.round(sourceHeight*scale));
 return [Math.floor((width-w)/2),Math.floor((height-h)/2),w,h];
}
function validateMetadata(meta){
 if(meta.version!==1||!Number.isInteger(meta.alphaThreshold)||meta.alphaThreshold<0||meta.alphaThreshold>254||!Array.isArray(meta.sheets)||!meta.sheets.length)throw Error('Unsupported lounge sprite metadata');
 const ids=new Set(),sources=new Set();
 for(const sheet of meta.sheets){
  if(!/^assets\/decor\/source\/[a-z0-9-]+\.png$/.test(sheet.source)||sources.has(sheet.source)||![sheet.rows,sheet.columns].every(n=>Number.isInteger(n)&&n>=1&&n<=8)||sheet.ids.length!==sheet.rows*sheet.columns)throw Error('Invalid lounge sprite sheet');
  sources.add(sheet.source);
  for(const id of sheet.ids){if(ids.has(id)||!library.items.some(item=>item.id===id))throw Error('Unknown or duplicate lounge asset: '+id);ids.add(id);}
 }
 return {ids:[...ids],sources:[...sources]};
}
async function extract(meta,alphaBounds,gridCells,fitRect){
 const load=async url=>{const image=new Image();image.src=url;await image.decode();return image;},items=[];
 for(let sheetIndex=0;sheetIndex<meta.sheets.length;sheetIndex++){
  const sheet=meta.sheets[sheetIndex],image=await load('/source/'+sheetIndex),width=image.naturalWidth,height=image.naturalHeight;
  const source=document.createElement('canvas');source.width=width;source.height=height;const s=source.getContext('2d',{willReadFrequently:true});s.drawImage(image,0,0);
  const rgba=s.getImageData(0,0,width,height).data;
  if([3,(width-1)*4+3,(height-1)*width*4+3,(width*height-1)*4+3].some(at=>rgba[at]>meta.alphaThreshold))throw Error('Sprite sheet must have a transparent background: '+sheet.source);
  const cells=gridCells(rgba,width,height,sheet.rows,sheet.columns,meta.alphaThreshold);
  for(let i=0;i<cells.length;i++){
   const id=sheet.ids[i],item=meta.items.find(value=>value.id===id),[cx,cy,cw,ch]=cells[i],pixels=s.getImageData(cx,cy,cw,ch).data,bounds=alphaBounds(pixels,cw,ch,meta.alphaThreshold);
   if(!bounds)throw Error('Empty lounge sprite cell: '+id);
   const [bx,by,bw,bh]=bounds,left=Math.max(0,bx-2),top=Math.max(0,by-2),right=Math.min(cw,bx+bw+2),bottom=Math.min(ch,by+bh+2),crop=[cx+left,cy+top,right-left,bottom-top];
   const placement=fitRect(crop[2],crop[3],item.width,item.height),out=document.createElement('canvas');
   if(meta.bottomAligned?.includes(id))placement[1]=item.height-placement[3]-2;
   out.width=item.width;out.height=item.height;const g=out.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;g.drawImage(image,...crop,...placement);
   const final=g.getImageData(0,0,out.width,out.height).data,visibleBounds=alphaBounds(final,out.width,out.height,meta.alphaThreshold);
   if(!visibleBounds)throw Error('Normalized lounge sprite is empty: '+id);
   const corners=[3,(out.width-1)*4+3,(out.height-1)*out.width*4+3,(out.width*out.height-1)*4+3].map(at=>final[at]);
   if(corners.some(alpha=>alpha!==0))throw Error('Normalized sprite corners must be transparent: '+id);
   items.push({...item,source:sheet.source,sourceSize:[width,height],cell:cells[i],crop,placement,visibleBounds,corners,data:out.toDataURL('image/png')});
  }
 }
 return items;
}
async function build(options={}){
 if(options.check&&options.dryRun)throw Error('Choose --check or --dry-run');
 const root=path.resolve(__dirname,'..'),meta=options.meta||metadata,paths=validateMetadata(meta),inputs=await Promise.all(paths.sources.map(source=>fs.readFile(path.join(root,source))));
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost').pathname;
  if(url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Lounge sprite builder</title>');return;}
  const match=/^\/source\/(\d+)$/.exec(url),bytes=match&&inputs[Number(match[1])];
  if(bytes){res.setHeader('Content-Type','image/png');res.end(bytes);return;}
  res.writeHead(url==='/favicon.ico'?204:404);res.end();
 });
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-lounge-assets-'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});let socket;
 try{
  let port;for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start');const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let serial=1;const jobs=new Map(),listeners=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const job=jobs.get(message.id);if(!job)return;jobs.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);}else listeners.get(message.method)?.(message.params);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=serial++,timer=setTimeout(()=>{jobs.delete(id);reject(Error('Timed out: '+method));},30000);jobs.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');const loaded=new Promise(resolve=>listeners.set('Page.loadEventFired',resolve));await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await loaded;
  const config={...meta,items:library.items.filter(item=>paths.ids.includes(item.id))};
  const expression=`(${extract.toString()})(${JSON.stringify(config)},(${alphaBounds.toString()}),(${gridCells.toString()}),(${fitRect.toString()}))`;
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  const records=[];
  for(const image of result.result.value){
   const {data,...record}=image,buffer=Buffer.from(data.split(',')[1],'base64'),output='assets/decor/v1/'+image.id+'.png';
   if(options.check){if(!(await fs.readFile(path.join(root,output))).equals(buffer))throw Error('Lounge sprite output is stale: '+output);}
   else if(!options.dryRun){await fs.mkdir(path.dirname(path.join(root,output)),{recursive:true});await fs.writeFile(path.join(root,output),buffer);}
   records.push({...record,output,sha256:createHash('sha256').update(buffer).digest('hex')});
  }
  const report={version:1,alphaThreshold:meta.alphaThreshold,sources:paths.sources.map((source,i)=>({path:source,sha256:createHash('sha256').update(inputs[i]).digest('hex')})),items:records},contents=JSON.stringify(report,null,2)+'\n';
  if(options.check){if(await fs.readFile(path.join(root,meta.manifest),'utf8')!==contents)throw Error('Lounge sprite manifest is stale');}
  else if(!options.dryRun)await fs.writeFile(path.join(root,meta.manifest),contents);
  process.stdout.write(JSON.stringify({mode:options.check?'check':options.dryRun?'preview':'write',items:records.length,sources:paths.sources.length})+'\n');return report;
 }finally{socket?.close();browser.kill('SIGTERM');server.close();if(browser.exitCode===null)await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
if(require.main===module)build({check:process.argv.includes('--check'),dryRun:process.argv.includes('--dry-run')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={alphaBounds,gridCells,fitRect,validateMetadata,extract,build};
