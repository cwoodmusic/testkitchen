'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {isLoopbackOrigin,loopbackProxyClass,websocketOptions}=require('../tools/firebase-emulator-loopback.cjs');
test('only loopback HTTP(S) emulator origins bypass the external proxy',()=>{
 for(const origin of ['http://127.0.0.1:9100','http://localhost:9098','http://[::1]:4410','https://127.0.0.1:9100'])assert.equal(isLoopbackOrigin(origin),true,origin);
 for(const origin of ['https://storage.googleapis.com','https://example.com','http://localhost.example.com','http://127.0.0.1.example.com','https://127.0.0.1@example.com','file:///tmp/test','not a URL'])assert.equal(isLoopbackOrigin(origin),false,origin);
});
test('external requests preserve original proxy dispatch and its unchanged options',()=>{
 const calls=[],handler={};class Original{constructor(options){this.options=options;}dispatch(options,received){calls.push(['proxy',options,received,this.options]);return true;}}
 const direct={dispatch(options,received){calls.push(['local',options,received]);return false;}},Patched=loopbackProxyClass(Original,direct),proxyOptions={uri:'http://configured-proxy.invalid:8080'},agent=new Patched(proxyOptions);
 const local={origin:'http://127.0.0.1:9100',path:'/.settings/rules.json'},external={origin:'https://storage.googleapis.com',path:'/verified-artifact',headers:{accept:'application/octet-stream'}};
 assert.equal(agent.dispatch(local,handler),false);assert.equal(agent.dispatch(external,handler),true);
 assert.deepEqual(calls,[['local',local,handler],['proxy',external,handler,proxyOptions]]);
});
test('Node SDK WebSocket transport removes only a local emulator connection proxy',()=>{
 const original={proxy:{origin:'http://configured-proxy.invalid:8080'},headers:{'User-Agent':'Firebase test'}},local=websocketOptions('ws://127.0.0.1:9100/.ws',original);
 assert.deepEqual(local,{headers:original.headers});assert.ok(original.proxy,'Original external proxy configuration remains intact');
 for(const url of ['wss://remote.firebaseio.com/.ws','ws://localhost.example.com','wss://127.0.0.1@example.com','https://127.0.0.1'])assert.equal(websocketOptions(url,original),original,url);
});
