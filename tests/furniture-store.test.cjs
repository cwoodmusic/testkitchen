const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const furniture=require('../furniture-catalog.js');
const Shop=require('../notes-shop.js');
const Profiles=require('../classroom-profile-data.js');
const priceTiers=require('./fixtures/town-furniture-price-tiers.json');
const price=id=>furniture.find(item=>item.id===id).price;
const total=ids=>ids.reduce((sum,id)=>sum+price(id),0);

function storage(balance){
 const values=new Map();
 if(balance!==undefined)values.set(Shop.KEY,JSON.stringify({version:1,balance,earned:balance,spent:0,owned:[],rewards:[]}));
 return {values,fail:false,getItem(key){return values.get(key)??null;},setItem(key,value){if(this.fail)throw Error('quota');values.set(key,String(value));},removeItem(key){values.delete(key);}};
}

test('all 100 previously published products retain every non-price field exactly',()=>{
 const original=require('./fixtures/town-stock-original-100.json').products;
 const restoredPrices=furniture.slice(0,100).map(item=>({...item,price:original.find(old=>old.id===item.id).price}));
 const digest=createHash('sha256').update(JSON.stringify(restoredPrices)).digest('hex');
 assert.equal(digest,'bad406b9bed9be100f733b5f8e88065e0d31034dac185821845337f8aae8da4a');
});

test('all484 furniture products use the expensive Notes tiers and fit within the unchanged wallet cap',()=>{
 const originals=require('./fixtures/town-stock-original-100.json').products;
 assert.equal(furniture.length,484);
 for(const item of furniture){
  const slot=item.collectionOwner&&item.asset.slice(('collection-'+item.collectionOwner+'-').length);
  assert.equal(item.price,item.collectionOwner?priceTiers.collectionSlots[slot]:priceTiers.legacy[item.id],item.id);
  assert.ok(item.price>=2000&&item.price<=150000,item.id);
  const original=originals.find(old=>old.id===item.id);
  if(original)assert.ok(item.price>original.price,item.id);
  const disk=storage(item.price),wallet=Shop.createWallet({storage:disk,preserveEquipped:false});
  assert.equal(wallet.buy(item.id).ok,true,item.id);
  assert.equal(wallet.snapshot().balance,0,item.id);
  assert.equal(wallet.snapshot().spent,item.price,item.id);
  const saved=disk.getItem(Shop.KEY);
  assert.equal(wallet.buy(item.id).alreadyOwned,true,item.id);
  assert.equal(disk.getItem(Shop.KEY),saved,'Owned pieces never debit again: '+item.id);
 }
 assert.equal(Math.min(...furniture.map(item=>item.price)),2000);
 assert.equal(Math.max(...furniture.map(item=>item.price)),150000);
 const capped=Shop.createWallet({storage:storage(1000000),preserveEquipped:false});
 assert.equal(capped.snapshot().balance,1000000);
 assert.equal(capped.buy('furniture-piano').balance,850000);
});

test('starter Notes cannot buy furniture and previously purchased cheap pieces stay owned without repricing',()=>{
 const disk=storage(),wallet=Shop.createWallet({storage:disk,preserveEquipped:false});
 assert.equal(wallet.snapshot().balance,150);
 for(const item of furniture){
  assert.equal(wallet.buy(item.id).ok,false,item.id);
  assert.equal(wallet.owns(item.id),false,item.id);
 }
 assert.equal(wallet.snapshot().balance,150);
 const historic={version:1,balance:0,earned:150,spent:150,owned:['furniture-bed','furniture-sofa'],rewards:[]};
 disk.setItem(Shop.KEY,JSON.stringify(historic));
 const restored=Shop.createWallet({storage:disk,preserveEquipped:false}),before=disk.getItem(Shop.KEY);
 assert.equal(restored.buy('furniture-bed').alreadyOwned,true);
 assert.equal(restored.buy('furniture-sofa').alreadyOwned,true);
 assert.equal(disk.getItem(Shop.KEY),before);
 const capture=Profiles.capture(disk),target=storage();assert.equal(capture.ok,true,capture.error);
 assert.equal(Profiles.apply(target,capture.data).ok,true);
 assert.deepEqual(Shop.createWallet({storage:target,preserveEquipped:false}).snapshot().owned,historic.owned);
 assert.equal(Shop.createWallet({storage:target,preserveEquipped:false}).snapshot().spent,150);
});

test('new showroom collections debit once and survive profile restoration alongside old purchases',()=>{
 const selected=['furniture-collection-showroom-midcentury-studio-bed','furniture-collection-showroom-midcentury-studio-poster','furniture-collection-showroom-midcentury-studio-lava-lamp'],disk=storage(total(selected)+14),wallet=Shop.createWallet({storage:disk,preserveEquipped:false});
 for(const id of selected)assert.equal(wallet.buy(id).ok,true,id);
 assert.equal(wallet.snapshot().balance,14);const before=JSON.stringify(wallet.snapshot());
 for(const id of selected)assert.equal(wallet.buy(id).alreadyOwned,true);
 assert.equal(JSON.stringify(wallet.snapshot()),before);
 const capture=Profiles.capture(disk),target=storage();assert.equal(capture.ok,true,capture.error);assert.equal(Profiles.apply(target,capture.data).ok,true);
 const restored=Shop.createWallet({storage:target,preserveEquipped:false});for(const id of selected)assert.equal(restored.owns(id),true);
 assert.equal(restored.snapshot().balance,14);assert.equal(restored.buy('furniture-collection-showroom-midcentury-studio-invented').ok,false);
});

test('the furniture catalog offers484 distinct native assets and matches browser ownership',async()=>{
 const {decorDefinitions}=await import('../town/world/decor-definitions.mjs');
 const {APARTMENT_DECOR}=await import('../town/world/apartment-decor-definitions.mjs');
 const {APARTMENT_COLLECTION_ASSETS}=await import('../town/world/apartment-collection-definitions.mjs');
 const signatures=JSON.parse(fs.readFileSync(require.resolve('../town/assets/showrooms/manifest.json'),'utf8')).assets;
 const native=new Set([...decorDefinitions.map(item=>item.id),...Array.from({length:9},(_,i)=>`furniture-${i}-180`),...signatures.map(item=>item.id),...APARTMENT_DECOR.map(item=>item.id),...APARTMENT_COLLECTION_ASSETS.map(item=>item.id)]);
 assert.equal(furniture.length,484);assert.equal(new Set(furniture.map(item=>item.id)).size,484);
 for(const item of furniture){
  assert.ok(native.has(item.asset),item.asset);assert.match(item.id,/^furniture-[a-z-]+$/);
  assert.ok(Number.isSafeInteger(item.price)&&item.price>0);assert.ok(Object.isFrozen(item));
 }
 const context={window:{}};
 for(const file of ['furniture-catalog.js','notes-shop.js','classroom-profile-data.js'])vm.runInNewContext(fs.readFileSync(require.resolve('../'+file),'utf8'),context);
 assert.equal(JSON.stringify(context.window.CodaFurnitureCatalog),JSON.stringify(furniture));
 assert.equal(JSON.stringify(context.window.CodaClassroomProfileData.SCHEMA),JSON.stringify(Profiles.SCHEMA));
 const browserWallet=context.window.CodaNotesShop.createWallet({storage:storage(price('furniture-sofa')),preserveEquipped:false});
 assert.equal(browserWallet.buy('furniture-sofa').ok,true);
});

test('the signature apartment collections preserve all legacy ownership IDs and match their displayed furniture',()=>{
 const legacy=['sofa','bed','kitchen-counter','stove','dining-table','vanity','piano','cello','double-bass','acoustic-guitar','electric-guitar','harp','upright-piano','synthesizer','jazz-drums','congas','saxophone','turntable','vinyl-bin','oak-bench','wicker-chair','cafe-table','chess-table','geranium','hydrangea','rose-planter','olive-tree','lemon-tree','fern','succulents','oak-barrel','travel-trunk','wicker-hamper','streetlamp','garden-lantern','wind-chimes'];
 assert.deepEqual(furniture.slice(0,36).map(item=>item.id),legacy.map(id=>'furniture-'+id));
 const signatures=JSON.parse(fs.readFileSync(require.resolve('../town/assets/showrooms/manifest.json'),'utf8')).assets;
 assert.equal(signatures.length,16);
 const themes=['victorian-parlor','art-deco-lounge','coastal-bedroom','rustic-kitchen','botanical-conservatory','midcentury-studio','french-cafe','industrial-loft'];
 for(const theme of themes)for(const role of ['bed','sofa']){
  const product=furniture.find(item=>item.id===`furniture-${theme}-${role}`),native=signatures.find(asset=>asset.id===product?.asset);
  assert(product,`${theme}: missing ${role}`);assert(native,`${theme}: displayed art is not a shop asset`);
  assert.equal(product.asset,`showroom-${theme}-${role}`);assert.equal(product.price,priceTiers.collectionSlots[role]);assert.equal(product.scale,1);assert.equal(product.category,'furniture');
  assert.equal(native.theme,theme);assert.equal(native.role,role);assert(native.w>0&&native.h>0);
 }
});

test('a guest can buy a matching apartment bed and sofa once and restore their ownership safely',()=>{
 const themes=['victorian-parlor','art-deco-lounge','coastal-bedroom','rustic-kitchen','botanical-conservatory','midcentury-studio','french-cafe','industrial-loft'];
 for(const theme of themes){
  const bed=`furniture-${theme}-bed`,sofa=`furniture-${theme}-sofa`,budget=total([bed,sofa]),disk=storage(budget),wallet=Shop.createWallet({storage:disk,preserveEquipped:false});
  assert.equal(wallet.buy(bed).ok,true);assert.equal(wallet.snapshot().balance,price(sofa));assert.equal(wallet.buy(sofa).ok,true);
  assert.equal(wallet.snapshot().balance,0);assert.equal(wallet.snapshot().spent,budget);
  const savedBefore=JSON.stringify(wallet.snapshot());assert.equal(wallet.buy(bed).alreadyOwned,true);assert.equal(wallet.buy(sofa).alreadyOwned,true);assert.equal(JSON.stringify(wallet.snapshot()),savedBefore);
  const capture=Profiles.capture(disk);assert.equal(capture.ok,true,capture.error);
  const target=storage();assert.equal(Profiles.apply(target,capture.data).ok,true);
  const restored=Shop.createWallet({storage:target,preserveEquipped:false});assert.equal(restored.owns(bed),true);assert.equal(restored.owns(sofa),true);assert.equal(restored.snapshot().balance,0);
  const before=JSON.stringify(restored.snapshot());assert.equal(restored.buy(`furniture-${theme}-invented`).ok,false);assert.equal(JSON.stringify(restored.snapshot()),before);
  const invalid=structuredClone(capture.data);invalid.wallet.owned.push(`furniture-${theme}-invented`);assert.equal(Profiles.validate(invalid).ok,false);
 }
});

test('new playful furniture and wall art debit once and survive player-profile restoration',()=>{
 const selected=['furniture-apartment-fox-plush','furniture-apartment-checkered-beanbag','furniture-apartment-starburst-clock'];
 const budget=total(selected)+150,disk=storage(budget),wallet=Shop.createWallet({storage:disk,preserveEquipped:false});
 for(const id of selected)assert.equal(wallet.buy(id).ok,true);
 assert.equal(wallet.snapshot().balance,150);
 const before=JSON.stringify(wallet.snapshot());for(const id of selected)assert.equal(wallet.buy(id).alreadyOwned,true);assert.equal(JSON.stringify(wallet.snapshot()),before);
 const captured=Profiles.capture(disk),target=storage();assert.equal(captured.ok,true,captured.error);assert.equal(Profiles.apply(target,captured.data).ok,true);
 const restored=Shop.createWallet({storage:target,preserveEquipped:false});for(const id of selected)assert.equal(restored.owns(id),true);
 assert.equal(furniture.find(i=>i.id==='furniture-apartment-starburst-clock').scale,.75);
});

test('furniture shares Notes, debits once, and keeps cosmetics across reload and classroom restore',()=>{
 const disk=storage(price('furniture-sofa')+80),catalog={headwear:[{id:'witch',label:'Witch hat'}]},wallet=Shop.createWallet({storage:disk,catalog});
 assert.equal(wallet.buy('witch').ok,true);assert.equal(wallet.buy('furniture-sofa').ok,true);
 assert.equal(wallet.snapshot().balance,0);assert.equal(wallet.buy('furniture-sofa').alreadyOwned,true);
 assert.equal(wallet.snapshot().spent,price('furniture-sofa')+80);
 const second=Shop.createWallet({storage:disk,catalog,preserveEquipped:false});
 assert.equal(second.owns('witch'),true);assert.equal(second.owns('furniture-sofa'),true);
 const saved=Profiles.capture(disk);assert.equal(saved.ok,true,saved.error);
 const target=storage();assert.equal(Profiles.apply(target,saved.data).ok,true);
 const restored=Shop.createWallet({storage:target,catalog,preserveEquipped:false});
 assert.equal(restored.owns('witch'),true);assert.equal(restored.owns('furniture-sofa'),true);assert.equal(restored.snapshot().balance,0);
});

test('failed furniture purchases cannot debit or unlock, and a second wallet refreshes the shared balance',()=>{
 const budget=total(['furniture-bed','furniture-sofa']),disk=storage(budget),first=Shop.createWallet({storage:disk}),second=Shop.createWallet({storage:disk});
 disk.fail=true;assert.equal(first.buy('furniture-sofa').ok,false);assert.equal(first.owns('furniture-sofa'),false);assert.equal(first.snapshot().balance,budget);
 disk.fail=false;assert.equal(first.buy('furniture-bed').ok,true);
 assert.equal(second.buy('furniture-piano').ok,false);assert.equal(second.snapshot().balance,price('furniture-sofa'));
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

function bridge(balance=60000){
 const html=fs.readFileSync(require.resolve('../world-preview.html'),'utf8'),start=html.indexOf('function sendTownState(){'),end=html.indexOf('requestAnimationFrame(frame);',start);
 const availabilityStart=html.indexOf('function townFurnitureAvailability(){'),availability=html.slice(availabilityStart,html.indexOf('\n',availabilityStart)),stateFunction=html.slice(start,html.indexOf('\ntownButton.onclick',start)),handler=html.slice(html.indexOf("window.addEventListener('message',event=>{",start),end);
 const disk=storage(balance),wallet=Shop.createWallet({storage:disk}),sent=[],source={postMessage(value,origin){sent.push({value,origin});}},listeners={};
 const context={window:{CodaFurnitureCatalog:furniture,ARCADE_ACCOUNTS_CONFIG:{classroom:{}},CodaClassroomStorageInstance:{getState:()=>context.scope},addEventListener(type,fn){listeners[type]=fn;}},townFrame:{contentWindow:source},townDialog:{open:true},location:{origin:'https://coda.test'},townOwner:'player-a',currentPlayerIdentity:()=>context.owner,currentTownRoomOwner:()=>JSON.stringify(['owner','class-a','student-a']),classroomCanPlay:()=>context.canPlay,classroomState:()=>({profile:context.profile}),scope:{mode:'guest',owned:false},profile:null,testMode:{isEnabled:()=>context.testEnabled,getState:()=>({isolated:context.testIsolated})},testEnabled:false,testIsolated:false,owner:'player-a',canPlay:true,avatar:{hairstyle:'bald'},notesWallet:wallet,musicHistory:{snapshot:()=>({people:[]})},closeTown(){context.closed=true;context.townFrame=null;}};
 vm.runInNewContext(availability+'\n'+stateFunction+'\n'+handler,context);
 return {context,wallet,sent,send(data,overrides={}){listeners.message({source,origin:'https://coda.test',data,...overrides});}};
}

test('the town purchase bridge accepts only furniture from the active same-origin town frame',()=>{
 const b=bridge(),buy={type:'coda-town-buy',id:'furniture-sofa',requestId:'purchase:1'};
 b.send(buy,{origin:'https://other.test'});b.send(buy,{source:{}});b.send({...buy,requestId:'<invalid>'});
 assert.equal(b.wallet.snapshot().balance,60000);assert.equal(b.sent.length,0);
 b.send({...buy,id:'witch'});assert.equal(b.sent[0].value.ok,false);assert.equal(b.wallet.owns('witch'),false);
 b.send(buy);assert.equal(b.wallet.snapshot().balance,60000-price('furniture-sofa'));assert.equal(b.wallet.owns('furniture-sofa'),true);
 b.send(buy);assert.equal(b.wallet.snapshot().balance,60000-price('furniture-sofa'));
 const result=b.sent.filter(item=>item.value.type==='coda-town-buy-result').at(-1);
 assert.equal(result.value.alreadyOwned,true);assert.equal(result.value.wallet.owned.includes('furniture-sofa'),true);
 const state=b.sent.find(item=>item.value.type==='coda-town-state-result');assert.equal(state.value.owner,'player-a');assert.equal(state.value.roomOwner,JSON.stringify(['owner','class-a','student-a']));
 for(const key of ['owner','canPlay']){const other=bridge();other.context[key]=key==='owner'?'player-b':false;other.send(buy);assert.equal(other.context.closed,true);assert.equal(other.wallet.snapshot().balance,60000);}
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
 assert.equal(b.wallet.owns('furniture-sofa'),true);assert.equal(b.wallet.snapshot().balance,60000-price('furniture-sofa'));
 assert.equal(b.sent.filter(item=>item.value.type==='coda-town-state-result').at(-1).value.furniturePurchasesEnabled,true);
});

test('signature furniture retains the same protected classroom purchase gate',()=>{
 const b=bridge(),id='furniture-art-deco-lounge-bed',buy={type:'coda-town-buy',id,requestId:'purchase:signature-gate'};
 b.context.scope={mode:'owner',owned:true};b.context.profile={classId:'class-a',profileId:'student-a'};
 const before=b.wallet.snapshot();b.send(buy);
 assert.deepEqual(b.wallet.snapshot(),before);assert.equal(b.wallet.owns(id),false);
 assert.equal(b.sent.find(item=>item.value.type==='coda-town-buy-result').value.ok,false);
 b.context.window.ARCADE_ACCOUNTS_CONFIG.classroom.townFurnitureEnabled=true;b.send(buy);
 assert.equal(b.wallet.owns(id),true);assert.equal(b.wallet.snapshot().balance,60000-price(id));
 b.send(buy);assert.equal(b.wallet.snapshot().balance,60000-price(id),'Owning a signature design does not permit a second debit');
});

test('guest shopping works before enablement and developer bypass requires isolated storage',()=>{
 const buy={type:'coda-town-buy',id:'furniture-sofa',requestId:'purchase:test'},guest=bridge();guest.send(buy);
 assert.equal(guest.wallet.owns('furniture-sofa'),true);
 for(const isolated of [false,true]){
  const b=bridge();b.context.scope={mode:'owner',owned:true};b.context.profile={classId:'class-a',profileId:'teacher-a',kind:'teacher'};
  b.context.testEnabled=true;b.context.testIsolated=isolated;b.send(buy);
  assert.equal(b.wallet.owns('furniture-sofa'),isolated);assert.equal(b.wallet.snapshot().balance,isolated?60000-price('furniture-sofa'):60000);
 }
});
