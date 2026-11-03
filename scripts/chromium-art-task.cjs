/* Run an offline Canvas artwork task with only explicit local inputs. */
'use strict';
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
async function run(files,task,args,helpers=[]){
 const server=http.createServer(async(req,res)=>{try{
  if(req.url==='/'){res.end('<!doctype html><title>Local artwork builder</title>');return;}
  if(!files[req.url]){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','image/png');res.end(await fs.readFile(files[req.url]));
 }catch(error){res.writeHead(500);res.end(error.message);}});
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'coda-art-task-'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let socket;
 try{
  let port;
  for(let attempt=0;attempt<100;attempt++){try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw Error('Chromium did not start');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let serial=0;const pending=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data),job=pending.get(message.id);if(!job)return;pending.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error(message.error.message)):job.resolve(message.result);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out: '+method));},60000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});
  const argumentsSource=[JSON.stringify(args),...helpers.map(fn=>'('+fn.toString()+')')].join(',');
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${task.toString()})(${argumentsSource})`});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
 }finally{socket?.close();browser.kill('SIGTERM');server.close();if(browser.exitCode===null)await new Promise(resolve=>browser.once('exit',resolve));await fs.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
}
module.exports={run};
