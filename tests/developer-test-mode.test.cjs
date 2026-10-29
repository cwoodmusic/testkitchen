'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {create,memoryStorage}=require('../developer-test-mode.js');
const storageAPI=require('../classroom-storage.js'),data=require('../classroom-profile-data.js'),progression=require('../player-progression.js');
const snap=storage=>Object.fromEntries(Array.from({length:storage.length},(_,index)=>{const key=storage.key(index);return [key,storage.getItem(key)];}));
function fixture({url='https://www.coda-arcade.com/world-preview.html?dev-test=1',owner=false,guestPrivate=false}={}){
 const local=memoryStorage(),session=memoryStorage(),listeners=new Map(),navigations=[],policies=[],idbCalls=[];
 const node=()=>({dataset:{},style:{},setAttribute(){},append(){},isConnected:true});
 const win={name:'original-window-name',crypto:webcrypto,CodaClassroomProfileData:data,CodaClassroomStorage:storageAPI,CodaPlayerProgression:progression,ARCADE_ACCOUNTS_CONFIG:{enabled:true,mode:'classroom',classroom:{privacy:true,enabled:true},firebase:{projectId:'private-project',apiKey:'not-a-secret'}},document:{head:{append(n){policies.push(n);}},createElement:node,body:{append(){}},documentElement:{append(){}}},queueMicrotask,
  location:{href:url,assign(value){navigations.push({method:'assign',url:value});},replace(value){navigations.push({method:'replace',url:value});}},addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);}};
 Object.defineProperty(win,'localStorage',{configurable:true,enumerable:true,value:local});Object.defineProperty(win,'sessionStorage',{configurable:true,enumerable:true,value:session});
 Object.defineProperty(win,'indexedDB',{configurable:true,value:{open(...args){idbCalls.push(args);},deleteDatabase(...args){idbCalls.push(args);}}});
 if(owner){
  const boundary=storageAPI.create({window:win,storage:local,sessionStorage:session,keys:data.SCOPED_KEYS});boundary.claim({classId:'teacher_personal',profileId:'teacher_owner_123'});boundary.destroy();
  const applied=data.apply(local,data.blank());assert.equal(applied.ok,true);
  local.setItem('musicArcadeV1',JSON.stringify({...JSON.parse(local.getItem('musicArcadeV1')),name:'Own arcade player'}));
 }else if(guestPrivate){local.setItem('musicArcadeV1',JSON.stringify({name:'Unbound private name',shirt:'#111111'}));local.setItem('codaDJLibraryV1','private composition');}
 local.setItem('codaWorldProjectV1','{"format":"CodaArcadeWorldProject","map":"own-layout"}');local.setItem('codaArcadeFXV1','lite');local.setItem('codaArcadeVibeV1','{"version":1,"selected":"spooky"}');local.setItem('firebase:authUser:private-project','DO NOT COPY THIS AUTH SECRET');session.setItem('firebase:authUser:admin','DO NOT COPY THIS SESSION SECRET');
 const originalName=win.name,localBefore=snap(local),sessionBefore=snap(session),config=win.ARCADE_ACCOUNTS_CONFIG;
 return {win,local,session,localBefore,sessionBefore,config,originalName,navigations,policies,idbCalls,pagehide(){for(const fn of listeners.get('pagehide')||[])fn();}};
}
function assertNativeUnchanged(f){assert.deepEqual(snap(f.local),f.localBefore);assert.deepEqual(snap(f.session),f.sessionBefore);}

test('ordinary pages do not read or replace storage, configuration, names or database APIs',()=>{
 const f=fixture({url:'https://www.coda-arcade.com/world-preview.html'}),beforeIDB=f.win.indexedDB;
 const mode=create(f.win);assert.equal(mode.isEnabled(),false);assert.equal(mode.seedUnlocks().ok,false);assert.equal(mode.mountBanner(),null);assert.equal(mode.exit(),false);
 assert.equal(f.win.localStorage,f.local);assert.equal(f.win.sessionStorage,f.session);assert.equal(f.win.indexedDB,beforeIDB);assert.equal(f.win.ARCADE_ACCOUNTS_CONFIG,f.config);assert.equal(f.win.name,f.originalName);assert.equal(f.policies.length,0);assertNativeUnchanged(f);
 const noisy={location:{href:'https://www.coda-arcade.com/world-preview.html'}};
 for(const key of ['localStorage','sessionStorage'])Object.defineProperty(noisy,key,{get(){throw Error('Ordinary mode must not read storage');}});
 assert.equal(create(noisy).isEnabled(),false);
});

test('an owned player is copied through a shadow boundary without mutating real stores or copying authentication',()=>{
 const f=fixture({owner:true}),mode=create(f.win);
 assert.deepEqual(mode.getState(),{enabled:true,isolated:true,seeded:false,source:'own-player',error:''});assertNativeUnchanged(f);assert.equal(f.win.name,f.originalName);
 assert.equal(JSON.parse(f.win.localStorage.getItem('musicArcadeV1')).name,'Own arcade player');assert.equal(f.win.localStorage.getItem('codaWorldProjectV1'),f.local.getItem('codaWorldProjectV1'));assert.equal(f.win.localStorage.getItem('codaArcadeVibeV1'),f.local.getItem('codaArcadeVibeV1'));
 assert.equal(f.win.localStorage.getItem('firebase:authUser:private-project'),null);assert.equal(f.win.sessionStorage.getItem('firebase:authUser:admin'),null);assert.equal(f.win.sessionStorage.length,0);
 f.win.localStorage.setItem('musicArcadeV1','sandbox change');f.win.sessionStorage.setItem('codaClassroomAdminTabV1','sandbox binding');f.win.localStorage.codaWorldProjectV1='changed map';f.win.localStorage.clear();assertNativeUnchanged(f);
 assert.equal(f.win.ARCADE_ACCOUNTS_CONFIG.enabled,false);assert.equal(f.win.ARCADE_ACCOUNTS_CONFIG.classroom.enabled,false);assert.equal(f.win.ARCADE_ACCOUNTS_CONFIG.classroom.privacy,true);assert.equal('firebase' in f.win.ARCADE_ACCOUNTS_CONFIG,false);
 assert.equal(f.policies.length,1);assert.match(f.policies[0].content,/connect-src 'self'/);
});

test('blocked workspaces and unbound guest stores never copy cached student progress or compositions',()=>{
 const owner=fixture({owner:true});owner.win.name='another-browsing-context';const blocked=create(owner.win);assert.equal(blocked.getState().source,'blank');assert.equal(owner.win.localStorage.length,0);assert.equal(blocked.seedUnlocks().ok,true);assert.equal(JSON.parse(owner.win.localStorage.musicArcadeV1).name,'Test player');assertNativeUnchanged(owner);
 const guest=fixture({guestPrivate:true}),mode=create(guest.win);assert.equal(mode.getState().source,'guest');assert.equal(guest.win.localStorage.getItem('musicArcadeV1'),null);assert.equal(guest.win.localStorage.getItem('codaDJLibraryV1'),null);assert.equal(guest.win.localStorage.getItem('codaArcadeFXV1'),'lite');assert.equal(mode.seedUnlocks().ok,true);assert.equal(JSON.parse(guest.win.localStorage.musicArcadeV1).name,'Test player');assertNativeUnchanged(guest);
});

test('unlock seeding creates coherent bounded journals, full wardrobe, memory melodies and level checkpoints only in memory',()=>{
 const f=fixture({owner:true}),mode=create(f.win);assert.equal(mode.seedUnlocks({progression,profileData:data}).ok,true);
 const captured=data.capture(f.win.localStorage);assert.equal(captured.ok,true,captured.error);
 const player=captured.data,owned=data.SCHEMA.properties.wallet.properties.owned.items.enum;
 assert.equal(progression.levelForXP(player.progression.xp),progression.THRESHOLDS.length);assert.equal(player.progression.xp,player.progression.events.reduce((sum,event)=>sum+event.xp,0));assert.ok(player.progression.events.every(event=>event.xp>=1&&event.xp<=1000));
 assert.equal(new Set(player.progression.events.map(event=>event.id)).size,player.progression.events.length);for(const item of progression.ACHIEVEMENT_REWARDS)assert.ok(player.progression.events.some(event=>event.id==='achievement:'+item.achievement));
 assert.equal(player.wallet.balance,1000000);assert.equal(player.wallet.earned-player.wallet.spent,player.wallet.balance);assert.deepEqual(new Set(player.wallet.owned),new Set(owned));assert.ok(player.wallet.owned.length<=256);for(const id of ['visitor-vee-jay','visitor-zizi','visitor-metronome'])assert.ok(player.wallet.owned.includes(id));
 assert.deepEqual(player.piano.learned,[...progression.PIANO_MEMORIES]);assert.ok(player.pitch.bestCompleted>=50);assert.ok(player.progression.bestPitchLevel>=50);assert.equal(JSON.parse(f.win.localStorage.musicArcadeV1).name,'Own arcade player');
 assert.ok(player.avatar.customized);assert.ok(player.avatar.jumps>=10);assert.ok(player.avatar.emotesUsed>=5);assert.ok(player.avatar.walked>=450);for(const id of ['bowtie','starclip','partyglasses','halo'])assert.ok(player.progression.events.some(event=>event.id==='achievement:'+id));
 const before=snap(f.win.localStorage);assert.equal(mode.seedUnlocks().alreadySeeded,true);assert.deepEqual(snap(f.win.localStorage),before);assertNativeUnchanged(f);assert.ok(!JSON.stringify(mode.getState()).includes('Own arcade player'));
});

test('the sandbox denies native IndexedDB access and restores the real browsing-context name on exit or navigation',()=>{
 const f=fixture({owner:true}),mode=create(f.win);assert.throws(()=>f.win.indexedDB.open('codaArcadeAssetStudioDB'),{name:'SecurityError'});assert.throws(()=>f.win.indexedDB.deleteDatabase('real-database'),{name:'SecurityError'});assert.deepEqual(f.idbCalls,[]);
 const boundary=storageAPI.create({window:f.win,keys:data.SCOPED_KEYS});assert.notEqual(f.win.name,f.originalName,'Sandbox boot receives a fresh in-memory tab id');assert.equal(f.win.sessionStorage.getItem(storageAPI.TAB_KEY),boundary.tabId);assertNativeUnchanged(f);
 f.pagehide();assert.equal(f.win.name,f.originalName);f.win.name='sandbox-name-again';assert.equal(mode.exit(),true);assert.equal(f.win.name,f.originalName);assert.equal(new URL(f.navigations.at(-1).url).searchParams.has('dev-test'),false);assert.equal(f.navigations.at(-1).method,'replace');assertNativeUnchanged(f);
});

test('sandbox tab names never write the browser context name that reloads and Google-session bindings inherit',()=>{
 const f=fixture({owner:true});let nativeName=f.originalName,writes=0;
 Object.defineProperty(f.win,'name',{configurable:true,enumerable:true,get:()=>nativeName,set:value=>{nativeName=String(value);writes++;}});
 const mode=create(f.win),boundary=storageAPI.create({window:f.win,keys:data.SCOPED_KEYS});
 assert.notEqual(f.win.name,f.originalName,'The sandbox still receives its own virtual workspace name');
 assert.equal(nativeName,f.originalName,'A new document inherits the untouched real browsing-context name');assert.equal(writes,0);
 f.win.name='another preview name';assert.equal(nativeName,f.originalName);assert.equal(writes,0);
 f.pagehide();assert.equal(nativeName,f.originalName);assert.equal(writes,0);assert.equal(mode.exit(),true);assert.equal(writes,0);
 boundary.destroy();assertNativeUnchanged(f);
});

test('enter uses a same-tab clean URL and drops profile actions and pass fragments',()=>{
 const f=fixture({url:'https://www.coda-arcade.com/world-preview.html?v=next&profile=admin#classroom-pass=PRIVATE'}),mode=create(f.win);assert.equal(mode.enter(),true);const nav=f.navigations[0],url=new URL(nav.url);assert.equal(nav.method,'assign');assert.equal(url.origin,'https://www.coda-arcade.com');assert.equal(url.pathname,'/world-preview.html');assert.equal(url.searchParams.get('dev-test'),'1');assert.equal(url.searchParams.get('v'),'next');assert.equal(url.searchParams.has('profile'),false);assert.equal(url.hash,'');assertNativeUnchanged(f);
});

test('unavailable native storage still permits a fresh isolated demo; nonreplaceable stores fail closed',()=>{
 const f=fixture();for(const key of ['localStorage','sessionStorage'])Object.defineProperty(f.win,key,{configurable:true,get(){throw Error('Storage blocked');}});
 const mode=create(f.win);assert.equal(mode.getState().isolated,true);assert.equal(mode.seedUnlocks().ok,true);assert.equal(JSON.parse(f.win.localStorage.musicArcadeV1).name,'Test player');assertNativeUnchanged(f);
 const frozen=fixture();Object.defineProperty(frozen.win,'localStorage',{configurable:false,value:frozen.local});const refused=create(frozen.win);assert.equal(refused.getState().isolated,false);assert.equal(refused.seedUnlocks().ok,false);assert.match(refused.getState().error,/safely/);assert.throws(()=>frozen.win.CodaClassroomStorage.create({window:frozen.win,keys:data.SCOPED_KEYS}),/unavailable/);assertNativeUnchanged(frozen);
});

test('a nonreplaceable browser name rolls back the storage overrides and fails closed',()=>{
 const f=fixture({owner:true}),database=f.win.indexedDB;
 Object.defineProperty(f.win,'name',{configurable:false,writable:true,value:f.originalName});
 const refused=create(f.win);assert.equal(refused.getState().isolated,false);assert.equal(refused.seedUnlocks().ok,false);
 assert.equal(f.win.localStorage,f.local);assert.equal(f.win.sessionStorage,f.session);assert.equal(f.win.indexedDB,database);assert.equal(f.win.name,f.originalName);
 assert.throws(()=>f.win.CodaClassroomStorage.create({window:f.win,keys:data.SCOPED_KEYS}),/unavailable/);assertNativeUnchanged(f);
});

test('memory Storage supports property and native-method operations without shared references',()=>{
 const memory=memoryStorage([['one','1']]);memory.two=2;assert.equal(memory.getItem('two'),'2');assert.equal(memory.length,2);assert.deepEqual(Object.keys(memory),['one','two']);delete memory.one;assert.equal(memory.key(0),'two');assert.equal(memory.key(-1),null);memory.clear();assert.equal(memory.length,0);
});
