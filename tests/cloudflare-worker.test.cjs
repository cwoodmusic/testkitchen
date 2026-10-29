'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const worker=import('../deploy/cloudflare/worker.mjs');
const site='https://www.coda-arcade.com';

test('main pages and nested assets map to the fixed main project',async()=>{
 const {upstreamURL}=await worker;
 for(const [path,expected]of [['/','/coda-arcade/'],['/world-preview.html?v=70','/coda-arcade/world-preview.html?v=70'],['/assets/world/map.png','/coda-arcade/assets/world/map.png'],['/song-machine/index.html?classroom=1','/coda-arcade/song-machine/index.html?classroom=1']])
  assert.equal(upstreamURL(site+path).href,'https://cwoodmusic.github.io'+expected);
});
test('each cabinet keeps its project prefix and exact query',async()=>{
 const {upstreamURL}=await worker;
 for(const name of ['Pitch-Race','musictriad','rhythmroom'])
  assert.equal(upstreamURL(site+'/'+name+'/index.html?classroom=1&v=next').href,'https://cwoodmusic.github.io/'+name+'/index.html?classroom=1&v=next');
 assert.equal(upstreamURL(site+'/coda-arcade/world-preview.html').pathname,'/coda-arcade/world-preview.html');
});
test('query parameters and confusing project-name prefixes cannot choose another upstream',async()=>{
 const {upstreamURL}=await worker;
 for(const path of ['/Pitch-Race-other/index.html','/api/auth?url=https://attacker.invalid/']){
  const target=upstreamURL(site+path);assert.equal(target.origin,'https://cwoodmusic.github.io');assert.ok(target.pathname.startsWith('/coda-arcade/'));
 }
 assert.equal(upstreamURL(site+'/https://attacker.invalid/'),null,'URL-shaped paths with ambiguous separators are rejected');
});
test('ambiguous encoded separators, traversal encodings and controls are rejected',async()=>{
 const {upstreamURL}=await worker;
 for(const path of ['/assets%2fsecret','/%5cattacker.invalid/a','/%252e%252e/musictriad/','/%00.js','/a%0a.js','/a%0d.js','/a//b','/bad%GG'])
  assert.equal(upstreamURL(site+path),null,path);
});
test('only safe read methods reach the upstream',async()=>{
 const {handleRequest}=await worker;let requests=0;
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
  const result=await handleRequest(new Request(site+'/',{method}),async()=>{requests++;});
  assert.equal(result.status,405);assert.equal(result.headers.get('Allow'),'GET, HEAD');
 }
 assert.equal(requests,0);
});
test('fresh upstream requests omit browser credentials and arbitrary private headers',async()=>{
 const {handleRequest}=await worker;let sent;
 const response=await handleRequest(new Request(site+'/song-machine/',{headers:{Cookie:'private-pass=do-not-forward',Authorization:'Bearer private',Origin:'https://student.invalid','X-Api-Key':'private','X-Private-Student':'private',Accept:'text/html','If-None-Match':'"version"'}}),async req=>{sent=req;return new Response('arcade');});
 assert.equal(await response.text(),'arcade');assert.equal(sent.redirect,'manual');
 assert.deepEqual([...sent.headers.keys()].sort(),['accept','if-none-match']);
 assert.equal(sent.headers.get('If-None-Match'),'"version"');
});
test('relative main redirects return to the custom origin with query and fragment',async()=>{
 const {handleRequest}=await worker;
 const response=await handleRequest(new Request(site+'/song-machine'),async()=>new Response(null,{status:301,headers:{Location:'/coda-arcade/song-machine/?song=abc#position'}}));
 assert.equal(response.status,301);assert.equal(response.headers.get('Location'),site+'/song-machine/?song=abc#position');
});
test('child redirects remain same origin and preserve the child prefix',async()=>{
 const {publicRedirect}=await worker;
 assert.equal(publicRedirect('/Pitch-Race/?classroom=1','https://cwoodmusic.github.io/Pitch-Race'),site+'/Pitch-Race/?classroom=1');
 assert.equal(publicRedirect('index.html?v=2','https://cwoodmusic.github.io/musictriad/'),site+'/musictriad/index.html?v=2');
});
test('external and unapproved upstream redirects are rejected without following them',async()=>{
 const {handleRequest,publicRedirect}=await worker;
 for(const location of ['https://attacker.invalid/','//attacker.invalid/','https://cwoodmusic.github.io/unrelated/','https://cwoodmusic.github.io/coda-arcade-other/']){
  assert.equal(publicRedirect(location,'https://cwoodmusic.github.io/coda-arcade/'),null);
  const result=await handleRequest(new Request(site+'/'),async()=>new Response(null,{status:302,headers:{Location:location}}));assert.equal(result.status,502);assert.equal(result.headers.get('Location'),null);
 }
});
test('audio byte ranges and content/cache headers pass through while cookies do not',async()=>{
 const {handleRequest}=await worker;let sent;
 const result=await handleRequest(new Request(site+'/rhythmroom/snare.wav',{headers:{Range:'bytes=4-7','If-Range':'"audio-v1"'}}),async req=>{sent=req;return new Response(new Uint8Array([1,2,3,4]),{status:206,headers:{'Content-Type':'audio/wav','Content-Length':'4','Content-Range':'bytes 4-7/12','Accept-Ranges':'bytes',ETag:'"audio-v1"','Cache-Control':'public, max-age=600','Set-Cookie':'private=value','WWW-Authenticate':'Bearer'}});});
 assert.equal(sent.headers.get('Range'),'bytes=4-7');assert.equal(sent.headers.get('If-Range'),'"audio-v1"');
 assert.equal(result.status,206);assert.equal(result.headers.get('Content-Range'),'bytes 4-7/12');assert.equal(result.headers.get('Content-Length'),'4');assert.equal(result.headers.get('Content-Type'),'audio/wav');assert.equal(result.headers.get('Cache-Control'),'public, max-age=600');
 assert.equal(result.headers.get('Set-Cookie'),null);assert.equal(result.headers.get('WWW-Authenticate'),null);assert.deepEqual([...new Uint8Array(await result.arrayBuffer())],[1,2,3,4]);
});
test('HEAD and not-modified responses stay bodyless with validator headers',async()=>{
 const {handleRequest}=await worker;let sent;
 const head=await handleRequest(new Request(site+'/world-preview.html',{method:'HEAD'}),async req=>{sent=req;return new Response(null,{headers:{ETag:'"world-v1"','Content-Length':'123'}});});
 assert.equal(sent.method,'HEAD');assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Length'),'123');
 const cached=await handleRequest(new Request(site+'/world-preview.html',{headers:{'If-Modified-Since':'Mon, 26 Oct 2026 10:00:00 GMT'}}),async req=>{assert.equal(req.headers.get('If-Modified-Since'),'Mon, 26 Oct 2026 10:00:00 GMT');return new Response(null,{status:304,headers:{ETag:'"world-v1"'}});});
 assert.equal(cached.status,304);assert.equal(cached.body,null);assert.equal(cached.headers.get('ETag'),'"world-v1"');
});
test('upstream failures return a readable noncacheable error',async()=>{
 const {handleRequest}=await worker;
 const result=await handleRequest(new Request(site+'/'),async()=>{throw Error('network');});
 assert.equal(result.status,502);assert.equal(result.headers.get('Cache-Control'),'no-store');assert.match(await result.text(),/try again/);
});

test('the domain uses HTTPS and refuses unrelated worker hostnames',async()=>{
 const worker=await import('../deploy/cloudflare/worker.mjs');
 let requests=0;const fetcher=async()=>{requests++;return new Response('unexpected');};
 const redirect=await worker.handleRequest(new Request('http://www.coda-arcade.com/Pitch-Race/?classroom=1'),fetcher);
 assert.equal(redirect.status,308);
 assert.equal(redirect.headers.get('Location'),'https://www.coda-arcade.com/Pitch-Race/?classroom=1');
 const denied=await worker.handleRequest(new Request('https://www.coda-arcade.com.attacker.test/'),fetcher);
 assert.equal(denied.status,421);assert.equal(requests,0);
});

test('both HTTP and HTTPS apex GET/HEAD redirect to www without fetching or losing path and query',async()=>{
 const {handleRequest}=await worker;let requests=0;
 const fetcher=async()=>{requests++;return new Response('unexpected');};
 for(const protocol of ['http:','https:'])for(const method of ['GET','HEAD']){
  const response=await handleRequest(new Request(protocol+'//coda-arcade.com/musictriad/?classroom=1&v=registered-73',{method}),fetcher);
  assert.equal(response.status,308);
  assert.equal(response.headers.get('Location'),site+'/musictriad/?classroom=1&v=registered-73');
  assert.equal(response.body,null);
 }
 assert.equal(requests,0);
});

test('unconfigured spellings and deceptive domain hosts are refused',async()=>{
 const {handleRequest}=await worker;let requests=0;
 const fetcher=async()=>{requests++;return new Response('unexpected');};
 for(const origin of ['https://www.coda-aracde.com','https://coda-aracde.com','https://www.coda-arcade.com.attacker.test','https://coda-arcade.com.attacker.test','https://www.coda-arcade.com:444','https://coda-arcade.com:444']){
  const response=await handleRequest(new Request(origin+'/'),fetcher);
  assert.equal(response.status,421,origin);
 }
 assert.equal(requests,0);
});

test('apex redirects retain path validation and reject write methods without upstream access',async()=>{
 const {handleRequest}=await worker;let requests=0;
 const fetcher=async()=>{requests++;return new Response('unexpected');};
 for(const path of ['/assets%2fsecret','/%252e%252e/musictriad/','/bad%GG']){
  const response=await handleRequest(new Request('https://coda-arcade.com'+path),fetcher);
  assert.equal(response.status,400,path);assert.equal(response.headers.get('Location'),null);
 }
 const response=await handleRequest(new Request('https://coda-arcade.com/',{method:'POST'}),fetcher);
 assert.equal(response.status,405);assert.equal(response.headers.get('Location'),null);
 assert.equal(requests,0);
});
