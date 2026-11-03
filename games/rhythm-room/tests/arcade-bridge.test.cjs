/* Execute the actual inline result bridge without loading the game or services. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script>(\/\/ Coda Arcade bridge v1:[\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'The production inline bridge must be present');
const trusted=['https://cwoodmusic.github.io','https://music-arcade.aquajelly16.chatgpt.site','https://www.coda-arcade.com','https://coda-arcade.com','https://www.coda-aracde.com','https://coda-aracde.com'];
function frame(standalone=false){
 const messages=[],listeners=new Map(),parent={postMessage:(data,origin)=>messages.push({data,origin})};
 const document={documentElement:{dataset:{codaGame:'rhythm'}}};
 const win={parent,addEventListener:(name,fn)=>listeners.set(name,fn)};if(standalone)win.parent=win;
 vm.runInNewContext(source,{window:win,document,crypto:{randomUUID:()=> 'domain-round'}});
 return {bridge:win.CodaBridge,parent,messages,receive:event=>listeners.get('message')?.(event)};
}
const result={mode:'tap',total:8,hits:8,extra:0,early:0,late:0};

test('new custom domain and both original origins can initialize the rhythm result bridge',()=>{
 for(const origin of trusted){
  const env=frame();assert.deepEqual(env.messages.map(m=>m.origin),trusted);
  assert.ok(env.messages.every(m=>m.data.type==='ready'&&m.data.game==='rhythm'));
  env.bridge.report('domain-round',result);
  env.receive({source:env.parent,origin,data:{coda:1,type:'init',game:'rhythm',token:'domain-session'}});
  const reports=env.messages.filter(m=>m.data.type==='result');assert.equal(reports.length,1);
  assert.equal(reports[0].origin,origin);assert.equal(reports[0].data.token,'domain-session');
  assert.equal(reports[0].data.game,'rhythm');assert.equal(reports[0].data.runId,'domain-round');
  env.bridge.report('domain-round',result);assert.equal(env.messages.filter(m=>m.data.type==='result').length,1);
 }
});

test('lookalike origins, other senders, wrong games and invalid tokens cannot receive results',()=>{
 const env=frame();env.bridge.report('domain-round',result);
 const good={source:env.parent,origin:trusted[2],data:{coda:1,type:'init',game:'rhythm',token:'domain-session'}};
 for(const origin of ['http://www.coda-arcade.com','http://coda-arcade.com','http://www.coda-aracde.com','http://coda-aracde.com','https://www.coda-arcade.com.evil.invalid','https://coda-arcade.com.evil.invalid','https://other.coda-arcade.com','https://www.coda-aracde.com.evil.invalid','https://coda-aracde.com.evil.invalid','https://www.coda-arcade.com:444','https://coda-arcade.com:444','https://www.coda-aracde.com:444','https://coda-aracde.com:444','https://cwoodmusic.github.io.evil.invalid'])env.receive({...good,origin});
 env.receive({...good,source:{}});env.receive({...good,data:{...good.data,game:'pitch'}});
 env.receive({...good,data:{...good.data,token:null}});env.receive({...good,data:{...good.data,token:'x'.repeat(101)}});
 assert.equal(env.messages.filter(m=>m.data.type==='result').length,0);
 env.receive(good);assert.equal(env.messages.filter(m=>m.data.type==='result').length,1);
});

test('standalone Rhythm Room does not send to a parent',()=>{
 const env=frame(true);assert.equal(env.bridge.id(),'domain-round');env.bridge.report('domain-round',result);
 assert.deepEqual(env.messages,[]);
});
