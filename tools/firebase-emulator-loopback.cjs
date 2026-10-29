/* Runtime workaround for Firebase CLI versions that ignore NO_PROXY.
 * Only local emulator traffic goes direct. External proxy/TLS settings stay.
 * Enable only in the demo-emulator runner, never as application code. */
'use strict';
const path=require('node:path');
const {createRequire}=require('node:module');

function isLoopbackOrigin(origin){
 try{const url=new URL(String(origin));return ['http:','https:'].includes(url.protocol)&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);}catch{return false;}
}
function websocketOptions(url,options){
 try{const parsed=new URL(String(url));if(!['ws:','wss:'].includes(parsed.protocol)||!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname))return options;}catch{return options;}
 if(!options?.proxy)return options;const local={...options};delete local.proxy;return local;
}
function loopbackProxyClass(ProxyAgent,direct){
 return class EmulatorLoopbackProxyAgent extends ProxyAgent{
  dispatch(options,handler){return isLoopbackOrigin(options.origin)?direct.dispatch(options,handler):super.dispatch(options,handler);}
 };
}
function install(){
 const base=path.resolve(process.env.CODA_FIREBASE_TEST_TOOLS||'/tmp/coda-classroom-emulator');
 const requireTool=createRequire(path.join(base,'node_modules/firebase-tools/lib/bin/firebase.js'));
 const undici=requireTool('undici');
 if(!undici.ProxyAgent.__codaEmulatorLoopback){
  const direct=new undici.Agent(),Patched=loopbackProxyClass(undici.ProxyAgent,direct);
  Object.defineProperty(Patched,'__codaEmulatorLoopback',{value:true});undici.ProxyAgent=Patched;
  process.once('exit',()=>{direct.destroy();});
 }
 // The Node RTDB SDK also passes HTTP_PROXY to faye for local WebSockets.
 // Strip only that one connection's proxy option; do not change process.env.
 const requireDatabase=createRequire(path.join(base,'node_modules/@firebase/database/package.json'));
 const websocket=requireDatabase('faye-websocket');
 if(!websocket.Client.__codaEmulatorLoopback){
  const Original=websocket.Client;class LocalClient extends Original{constructor(url,protocols,options){super(url,protocols,websocketOptions(url,options));}}
  Object.defineProperty(LocalClient,'__codaEmulatorLoopback',{value:true});websocket.Client=LocalClient;
 }
}
if(process.env.CODA_FIREBASE_LOOPBACK_PROXY==='1')install();
module.exports={isLoopbackOrigin,loopbackProxyClass,websocketOptions};
