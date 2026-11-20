import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {GAME_ROOT,RUNTIME_FILES,releaseVersion,expectedRelease,buildRelease,checkRelease} from './build-release.mjs';
import {launchQuietBell,validReleaseVersion} from './launcher.mjs';

const OLD='r-1111111111111111',NEW='r-2222222222222222';
const page=version=>`<!doctype html><html><head><meta name="quiet-bell-release" content="${version}"></head><body><script type="module" src="app.mjs"></script></body></html>`;
function fakeDocument(){
  const status={textContent:''},retry={hidden:true,addEventListener(type,fn){this.callback=fn;}};
  return {writes:[],opened:0,closed:0,status,retry,open(){this.opened++;},write(html){this.writes.push(html);},close(){this.closed++;},getElementById(id){return id==='quiet-bell-launch-status'?status:id==='quiet-bell-launch-retry'?retry:null;}};
}
function harness(handler){
  const document=fakeDocument(),calls=[],location={href:'https://cwoodmusic.github.io/testkitchen/games/rhythm-blocks/?v=old-bookmark',reload(){this.reloaded=true;}};
  const fetch=async(url,options)=>{calls.push({url:new URL(url),options});return await handler(new URL(url),options);};
  return {document,location,calls,options:{fallbackVersion:OLD,document,location,fetch,manifestTimeoutMs:20,releaseTimeoutMs:20}};
}

test('the checked-in launcher, manifest and complete immutable package match current source',()=>{
  assert.deepEqual(checkRelease().problems,[]);
  const expected=expectedRelease();
  assert(validReleaseVersion(expected.version));
  assert.equal(JSON.parse(expected.manifest).version,expected.version);
  assert.match(expected.launcher,/fallbackVersion:"r-[0-9a-f]{16}"/);
  assert(!expected.launcher.includes('src="launcher.mjs'));
  const html=expected.files.get('index.html').toString();
  assert(html.includes(`content="${expected.version}"`));
  assert(html.includes('href="../../../../world-preview.html"'));
  assert(html.includes('id="room-review" href="../../review/" target="_blank" rel="noopener"'));
  assert(expected.files.get('room-review.html').toString().includes(`content="${expected.version}"`));
  assert(expected.reviewLauncher.includes('view:"room-review"'));
  for(const name of RUNTIME_FILES.filter(name=>name!=='game.html'))assert(expected.files.has(name));
});

test('source changes generate a new path, preserve prior releases and detect stale packages',()=>{
  const root=mkdtempSync(join(tmpdir(),'quiet-bell-release-'));
  try{
    for(const name of [...RUNTIME_FILES,'launcher.mjs','build-release.mjs']){
      const target=join(root,name);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,readFileSync(join(GAME_ROOT,name)));
    }
    const first=buildRelease(root),original=readFileSync(join(root,'releases',first.version,'app.mjs'));
    assert.deepEqual(checkRelease(root).problems,[]);
    assert.equal(releaseVersion(root),first.version);
    assert.equal(buildRelease(root).version,first.version);
    writeFileSync(join(root,'app.mjs'),Buffer.concat([original,Buffer.from('\n// A new runtime.\n')]));
    assert.notEqual(releaseVersion(root),first.version);
    assert(checkRelease(root).problems.length>0);
    const second=buildRelease(root);
    assert.deepEqual(checkRelease(root).problems,[]);
    assert.deepEqual(readFileSync(join(root,'releases',first.version,'app.mjs')),original);
    assert.equal(readdirSync(join(root,'releases')).length,2);
    const target=join(root,'releases',second.version,'app.mjs');writeFileSync(target,'changed');
    assert(checkRelease(root).problems.some(problem=>problem.includes('app.mjs')));
    assert.throws(()=>buildRelease(root),/immutable/);
    assert(existsSync(join(root,'releases',first.version,'index.html')));
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('a cached entry checks a fresh manifest then loads all runtime references under its release path',async()=>{
  const fixture=harness(async url=>url.pathname.endsWith('release.json')?new Response(JSON.stringify({schemaVersion:1,version:NEW,url:'https://untrusted.invalid/'})):new Response(page(NEW)));
  assert.deepEqual(await launchQuietBell(fixture.options),{version:NEW,usedFallback:false});
  assert.equal(fixture.calls.length,2);
  const manifest=fixture.calls[0];
  assert.equal(manifest.options.cache,'no-store');assert(manifest.url.searchParams.has('check'));
  assert.equal(manifest.options.mode,'same-origin');assert.equal(manifest.options.redirect,'error');
  assert.equal(fixture.calls[1].url.pathname,`/testkitchen/games/rhythm-blocks/releases/${NEW}/index.html`);
  assert.equal(fixture.calls[1].options.cache,'force-cache');
  assert.equal(fixture.document.opened,1);assert.equal(fixture.document.closed,1);
  assert(fixture.document.writes[0].includes(`<base href="https://cwoodmusic.github.io/testkitchen/games/rhythm-blocks/releases/${NEW}/">`));
  assert.equal(fixture.location.href,'https://cwoodmusic.github.io/testkitchen/games/rhythm-blocks/?v=old-bookmark');
});

test('the stable review address checks the parent manifest and opens its matching immutable tool',async()=>{
  const fixture=harness(async url=>url.pathname.endsWith('release.json')?new Response(JSON.stringify({schemaVersion:1,version:NEW})):new Response(page(NEW)));
  fixture.location.href='https://cwoodmusic.github.io/testkitchen/games/rhythm-blocks/review/?v=old-bookmark';
  assert.deepEqual(await launchQuietBell({...fixture.options,view:'room-review'}),{version:NEW,usedFallback:false});
  assert.equal(fixture.calls[0].url.pathname,'/testkitchen/games/rhythm-blocks/release.json');
  assert.equal(fixture.calls[0].options.cache,'no-store');
  assert.equal(fixture.calls[1].url.pathname,`/testkitchen/games/rhythm-blocks/releases/${NEW}/room-review.html`);
  assert(fixture.document.writes[0].includes(`<base href="https://cwoodmusic.github.io/testkitchen/games/rhythm-blocks/releases/${NEW}/">`));
  assert.equal(fixture.location.href,'https://cwoodmusic.github.io/testkitchen/games/rhythm-blocks/review/?v=old-bookmark');
});

test('review entry selection is fixed data and a failed load keeps saved comments intact',async()=>{
  for(const view of ['../room-review.html','https://untrusted.invalid/',null,{},'game\n']){
    const fixture=harness(async()=>new Response(page(OLD)));
    await assert.rejects(()=>launchQuietBell({...fixture.options,view}),/Invalid bundled view/);
    assert.equal(fixture.calls.length,0);
  }
  const fixture=harness(async()=>new Response('missing',{status:404}));
  fixture.location.href='https://cwoodmusic.github.io/testkitchen/games/rhythm-blocks/review/';
  assert.deepEqual(await launchQuietBell({...fixture.options,view:'room-review'}),{version:null,usedFallback:true});
  assert.match(fixture.document.status.textContent,/saved comments are still on this device/);
  assert.equal(fixture.document.writes.length,0);
  assert.equal(fixture.document.retry.hidden,false);
});

test('manifest text cannot choose an external address, traversal path or unsupported catalog',async()=>{
  for(const manifest of [{schemaVersion:2,version:NEW},{schemaVersion:1,version:'https://untrusted.invalid/'},{schemaVersion:1,version:'../other'},{schemaVersion:1,version:'r-ABCDEF0123456789'},{schemaVersion:1,version:null},[],null]){
    const fixture=harness(async url=>url.pathname.endsWith('release.json')?new Response(JSON.stringify(manifest)):new Response(page(OLD)));
    assert.equal((await launchQuietBell(fixture.options)).version,OLD);
    assert.equal(fixture.calls.length,2);
    assert(fixture.calls.every(call=>call.url.origin==='https://cwoodmusic.github.io'));
    assert(fixture.calls[1].url.pathname.endsWith(`/releases/${OLD}/index.html`));
  }
  for(const version of ['',OLD+'/other',OLD+'\n','r-0000000000000000?x=1',{},null,1])assert.equal(validReleaseVersion(version),false);
});

test('a failed or unreadable manifest uses the baked package without a redirect or second check',async()=>{
  for(const failure of ['network','json','status']){
    const fixture=harness(async url=>{
      if(!url.pathname.endsWith('release.json'))return new Response(page(OLD));
      if(failure==='network')throw new Error('Offline');
      return new Response(failure==='json'?'broken':'missing',{status:failure==='status'?404:200});
    });
    assert.equal((await launchQuietBell(fixture.options)).version,OLD);
    assert.equal(fixture.calls.length,2);
    assert.equal(fixture.document.writes.length,1);
  }
});

test('an unavailable or invalid new HTML package falls back once to the baked release',async()=>{
  for(const bad of [null,page(OLD),`<html><head><meta name="quiet-bell-release" content="${NEW}"><base href="https://untrusted.invalid/"></head></html>`]){
    const fixture=harness(async url=>{
      if(url.pathname.endsWith('release.json'))return new Response(JSON.stringify({schemaVersion:1,version:NEW}));
      if(url.pathname.includes(`/releases/${NEW}/`))return new Response(bad??'missing',{status:bad===null?404:200});
      return new Response(page(OLD));
    });
    assert.deepEqual(await launchQuietBell(fixture.options),{version:OLD,usedFallback:true});
    assert.equal(fixture.calls.length,3);assert.equal(fixture.document.writes.length,1);
  }
});

test('manifest and HTML deadlines are bounded even if a transport ignores cancellation',async()=>{
  for(const hangs of ['manifest','new-html']){
    const fixture=harness(async(url,options)=>{
      const manifest=url.pathname.endsWith('release.json');
      if(hangs==='manifest'&&manifest||hangs==='new-html'&&url.pathname.includes(`/releases/${NEW}/`))return new Promise(()=>{});
      return new Response(manifest?JSON.stringify({schemaVersion:1,version:NEW}):page(OLD));
    });
    assert.equal((await launchQuietBell(fixture.options)).version,OLD);
    const timedOut=fixture.calls.find(call=>call.options.signal.aborted);
    assert(timedOut);
    assert.equal(fixture.document.writes.length,1);
  }
});

test('total failure keeps an actionable error and retry without writing a partial document',async()=>{
  const fixture=harness(async()=>new Response('not found',{status:404}));
  assert.deepEqual(await launchQuietBell(fixture.options),{version:null,usedFallback:true});
  assert.equal(fixture.calls.length,2);assert.equal(fixture.document.opened,0);assert.equal(fixture.document.writes.length,0);
  assert.match(fixture.document.status.textContent,/saved progress is still on this device/);
  assert.equal(fixture.document.retry.hidden,false);fixture.document.retry.callback();assert.equal(fixture.location.reloaded,true);
  await assert.rejects(()=>launchQuietBell({...fixture.options,fallbackVersion:'../other'}),/Invalid bundled release/);
});
