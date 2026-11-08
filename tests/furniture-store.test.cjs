const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const furniture=require('../furniture-catalog.js');
const Shop=require('../notes-shop.js');
const Profiles=require('../classroom-profile-data.js');

function storage(){
 const values=new Map();
 return {values,fail:false,getItem(key){return values.get(key)??null;},setItem(key,value){if(this.fail)throw Error('quota');values.set(key,String(value));},removeItem(key){values.delete(key);}};
}

test('the furniture catalog offers36distinct native assets and matches browser ownership',async()=>{
 const {decorDefinitions}=await import('../town/world/decor-definitions.mjs');
 const native=new Set([...decorDefinitions.map(item=>item.id),...Array.from({length:9},(_,i)=>`furniture-${i}-180`)]);
 assert.equal(furniture.length,36);assert.equal(new Set(furniture.map(item=>item.id)).size,36);
 for(const item of furniture){
  assert.ok(native.has(item.asset),item.asset);assert.match(item.id,/^furniture-[a-z-]+$/);
  assert.ok(Number.isSafeInteger(item.price)&&item.price>0);assert.ok(Object.isFrozen(item));
 }
 const context={window:{}};
 for(const file of ['furniture-catalog.js','notes-shop.js','classroom-profile-data.js'])vm.runInNewContext(fs.readFileSync(require.resolve('../'+file),'utf8'),context);
 assert.equal(JSON.stringify(context.window.CodaFurnitureCatalog),JSON.stringify(furniture));
 assert.equal(JSON.stringify(context.window.CodaClassroomProfileData.SCHEMA),JSON.stringify(Profiles.SCHEMA));
 const browserWallet=context.window.CodaNotesShop.createWallet({storage:storage(),preserveEquipped:false});
 assert.equal(browserWallet.buy('furniture-sofa').ok,true);
});

test('furniture shares Notes, debits once, and keeps cosmetics across reload and classroom restore',()=>{
 const disk=storage(),catalog={headwear:[{id:'witch',label:'Witch hat'}]},wallet=Shop.createWallet({storage:disk,catalog});
 assert.equal(wallet.buy('witch').ok,true);assert.equal(wallet.buy('furniture-sofa').ok,true);
 assert.equal(wallet.snapshot().balance,0);assert.equal(wallet.buy('furniture-sofa').alreadyOwned,true);
 assert.equal(wallet.snapshot().spent,150);
 const second=Shop.createWallet({storage:disk,catalog,preserveEquipped:false});
 assert.equal(second.owns('witch'),true);assert.equal(second.owns('furniture-sofa'),true);
 const saved=Profiles.capture(disk);assert.equal(saved.ok,true,saved.error);
 const target=storage();assert.equal(Profiles.apply(target,saved.data).ok,true);
 const restored=Shop.createWallet({storage:target,catalog,preserveEquipped:false});
 assert.equal(restored.owns('witch'),true);assert.equal(restored.owns('furniture-sofa'),true);assert.equal(restored.snapshot().balance,0);
});

test('failed furniture purchases cannot debit or unlock, and a second wallet refreshes the shared balance',()=>{
 const disk=storage(),first=Shop.createWallet({storage:disk}),second=Shop.createWallet({storage:disk});
 disk.fail=true;assert.equal(first.buy('furniture-sofa').ok,false);assert.equal(first.owns('furniture-sofa'),false);assert.equal(first.snapshot().balance,150);
 disk.fail=false;assert.equal(first.buy('furniture-bed').ok,true);
 assert.equal(second.buy('furniture-piano').ok,false);assert.equal(second.snapshot().balance,70);
 assert.equal(second.buy('furniture-sofa').ok,true);assert.equal(second.snapshot().balance,0);
 assert.equal(first.buy('furniture-made-up').ok,false);
});

test('room layouts stay local, clear between students, and survive guest backup restoration',()=>{
 const disk=storage(),layout=JSON.stringify({version:1,owner:'guest',items:[{id:'furniture-sofa',x:500,y:600}]});
 disk.setItem('codaUrbanRoomV1',layout);
 const backup=Profiles.backup(disk),captured=Profiles.capture(disk);assert.equal(captured.ok,true);
 assert.equal(JSON.stringify(captured.data).includes('codaUrbanRoomV1'),false);
 assert.equal(Profiles.apply(disk,Profiles.blank()).ok,true);assert.equal(disk.getItem('codaUrbanRoomV1'),null);
 assert.equal(Profiles.restore(disk,backup).ok,true);assert.equal(disk.getItem('codaUrbanRoomV1'),layout);
 const old=JSON.parse(JSON.stringify(backup));delete old.values.codaUrbanRoomV1;
 assert.equal(Profiles.restore(disk,old).ok,true,'Older guest backups remain valid');
});

function bridge(){
 const html=fs.readFileSync(require.resolve('../world-preview.html'),'utf8'),start=html.indexOf('function sendTownState(){'),end=html.indexOf('requestAnimationFrame(frame);',start);
 const availabilityStart=html.indexOf('function townFurnitureAvailability(){'),availability=html.slice(availabilityStart,html.indexOf('\n',availabilityStart)),stateFunction=html.slice(start,html.indexOf('\ntownButton.onclick',start)),handler=html.slice(html.indexOf("window.addEventListener('message',event=>{",start),end);
 const disk=storage(),wallet=Shop.createWallet({storage:disk}),sent=[],source={postMessage(value,origin){sent.push({value,origin});}},listeners={};
 const context={window:{CodaFurnitureCatalog:furniture,ARCADE_ACCOUNTS_CONFIG:{classroom:{}},CodaClassroomStorageInstance:{getState:()=>context.scope},addEventListener(type,fn){listeners[type]=fn;}},townFrame:{contentWindow:source},townDialog:{open:true},location:{origin:'https://coda.test'},townOwner:'player-a',currentPlayerIdentity:()=>context.owner,currentTownRoomOwner:()=>JSON.stringify(['owner','class-a','student-a']),classroomCanPlay:()=>context.canPlay,classroomState:()=>({profile:context.profile}),scope:{mode:'guest',owned:false},profile:null,testMode:{isEnabled:()=>context.testEnabled,getState:()=>({isolated:context.testIsolated})},testEnabled:false,testIsolated:false,owner:'player-a',canPlay:true,avatar:{hairstyle:'bald'},notesWallet:wallet,musicHistory:{snapshot:()=>({people:[]})},closeTown(){context.closed=true;context.townFrame=null;}};
 vm.runInNewContext(availability+'\n'+stateFunction+'\n'+handler,context);
 return {context,wallet,sent,send(data,overrides={}){listeners.message({source,origin:'https://coda.test',data,...overrides});}};
}

test('the town purchase bridge accepts only furniture from the active same-origin town frame',()=>{
 const b=bridge(),buy={type:'coda-town-buy',id:'furniture-sofa',requestId:'purchase:1'};
 b.send(buy,{origin:'https://other.test'});b.send(buy,{source:{}});b.send({...buy,requestId:'<invalid>'});
 assert.equal(b.wallet.snapshot().balance,150);assert.equal(b.sent.length,0);
 b.send({...buy,id:'witch'});assert.equal(b.sent[0].value.ok,false);assert.equal(b.wallet.owns('witch'),false);
 b.send(buy);assert.equal(b.wallet.snapshot().balance,80);assert.equal(b.wallet.owns('furniture-sofa'),true);
 b.send(buy);assert.equal(b.wallet.snapshot().balance,80);
 const result=b.sent.filter(item=>item.value.type==='coda-town-buy-result').at(-1);
 assert.equal(result.value.alreadyOwned,true);assert.equal(result.value.wallet.owned.includes('furniture-sofa'),true);
 const state=b.sent.find(item=>item.value.type==='coda-town-state-result');assert.equal(state.value.owner,'player-a');assert.equal(state.value.roomOwner,JSON.stringify(['owner','class-a','student-a']));
 for(const key of ['owner','canPlay']){const other=bridge();other.context[key]=key==='owner'?'player-b':false;other.send(buy);assert.equal(other.context.closed,true);assert.equal(other.wallet.snapshot().balance,150);}
});

test('room owner is stable across reconnects and separates students from guest storage',()=>{
 const html=fs.readFileSync(require.resolve('../world-preview.html'),'utf8'),start=html.indexOf('function currentTownRoomOwner(){'),source=html.slice(start,html.indexOf('\n',start));
 const context={window:{CodaClassroomStorageInstance:{getState:()=>context.scope}},classroomState:()=>({profile:context.profile}),scope:{mode:'owner',owned:true,marker:{epoch:'first',classId:'class-a',profileId:'student-a'}},profile:{classId:'class-a',profileId:'student-a'}};
 vm.runInNewContext(source,context);const before=context.currentTownRoomOwner();
 context.scope.marker.epoch='second';assert.equal(context.currentTownRoomOwner(),before);
 context.profile.profileId='student-b';assert.notEqual(context.currentTownRoomOwner(),before);
 context.scope.mode='guest';context.scope.owned=false;assert.equal(context.currentTownRoomOwner(),'guest');
});

test('cloud profile purchases wait for explicit rules enablement without changing Notes or ownership',()=>{
 const b=bridge(),buy={type:'coda-town-buy',id:'furniture-sofa',requestId:'purchase:gate'};
 b.context.scope={mode:'owner',owned:true};b.context.profile={classId:'class-a',profileId:'student-a'};
 const before=b.wallet.snapshot();b.send(buy);
 assert.deepEqual(b.wallet.snapshot(),before);assert.equal(b.wallet.owns('furniture-sofa'),false);
 const blocked=b.sent.find(item=>item.value.type==='coda-town-buy-result');assert.equal(blocked.value.ok,false);assert.match(blocked.value.error,/classroom profiles.*not available/);
 const state=b.sent.find(item=>item.value.type==='coda-town-state-result');assert.equal(state.value.furniturePurchasesEnabled,false);assert.ok(state.value.furniturePurchasesMessage);
 b.context.window.ARCADE_ACCOUNTS_CONFIG.classroom.townFurnitureEnabled=true;b.send(buy);
 assert.equal(b.wallet.owns('furniture-sofa'),true);assert.equal(b.wallet.snapshot().balance,80);
 assert.equal(b.sent.filter(item=>item.value.type==='coda-town-state-result').at(-1).value.furniturePurchasesEnabled,true);
});

test('guest shopping works before enablement and developer bypass requires isolated storage',()=>{
 const buy={type:'coda-town-buy',id:'furniture-sofa',requestId:'purchase:test'},guest=bridge();guest.send(buy);
 assert.equal(guest.wallet.owns('furniture-sofa'),true);
 for(const isolated of [false,true]){
  const b=bridge();b.context.scope={mode:'owner',owned:true};b.context.profile={classId:'class-a',profileId:'teacher-a',kind:'teacher'};
  b.context.testEnabled=true;b.context.testIsolated=isolated;b.send(buy);
  assert.equal(b.wallet.owns('furniture-sofa'),isolated);assert.equal(b.wallet.snapshot().balance,isolated?80:150);
 }
});
