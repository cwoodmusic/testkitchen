const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {createWallet,createShopUI,STOCK,KEY,STARTER_NOTES,denominationBreakdown,coinSVG,gameReward}=require('../notes-shop.js');

function storage(){
  const records=new Map();
  return {records,fail:false,getItem(key){if(this.fail)throw new Error('denied');return records.get(key)||null;},setItem(key,value){if(this.fail)throw new Error('quota');records.set(key,value);}};
}
test('completed games provide repeatable income without paying twice for a run',()=>{
  assert.equal(gameReward('triad',{mode:'computer',won:true}),16);
  assert.equal(gameReward('triad',{mode:'computer',won:false}),4);
  assert.equal(gameReward('pitch',{correct:10,won:false}),8);
  assert.equal(gameReward('pitch',{correct:0,won:true}),0);
  assert.equal(gameReward('rhythm',{total:10,hits:10,extra:0}),16);
  assert.equal(gameReward('rhythm',{total:10,hits:10,extra:10}),8);
  assert.equal(gameReward('rhythm',{total:10,hits:11,extra:0}),0);
  const wallet=createWallet({storage:storage()});
  wallet.grantReward('game:triad:run-1',16);wallet.grantReward('game:triad:run-1',16);
  wallet.grantReward('game:triad:run-2',16);assert.equal(wallet.snapshot().balance,182);
});
test('a guest gets a durable starter wallet and purchases debit once across reloads',()=>{
  const disk=storage(),wallet=createWallet({storage:disk});
  assert.equal(wallet.snapshot().balance,STARTER_NOTES);assert.equal(wallet.snapshot().persistent,true);
  assert.equal(wallet.buy('witch').ok,true);assert.equal(wallet.snapshot().balance,70);
  assert.equal(wallet.owns('witch'),true);assert.equal(wallet.buy('witch').alreadyOwned,true);
  assert.equal(wallet.snapshot().balance,70,'A double click cannot charge for the same item twice');
  const loaded=createWallet({storage:disk});assert.equal(loaded.owns('witch'),true);assert.equal(loaded.snapshot().balance,70);
  assert.equal(loaded.buy('wizard').ok,false);assert.equal(loaded.snapshot().balance,70);
  assert.equal(loaded.owns('wizard'),false);assert.equal(loaded.buy('missing').ok,false);
});
test('a failing write never debits Notes, grants an item, or consumes a lesson reward',()=>{
  const disk=storage(),wallet=createWallet({storage:disk}),saved=disk.getItem(KEY);disk.fail=true;
  assert.equal(wallet.buy('witch').ok,false);assert.equal(wallet.snapshot().balance,150);
  assert.equal(wallet.owns('witch'),false);assert.equal(wallet.snapshot().persistent,false);
  assert.equal(wallet.grantReward('piano:ode',75).ok,false);assert.equal(wallet.snapshot().balance,150);
  assert.deepEqual(wallet.snapshot().rewards,[]);assert.equal(disk.records.get(KEY),saved);
  disk.fail=false;assert.equal(wallet.grantReward('piano:ode',75).ok,true);
  assert.equal(wallet.snapshot().balance,225);assert.equal(wallet.snapshot().persistent,true);
});
test('lesson rewards are awarded once per persistent ID and reject malformed values',()=>{
  const disk=storage(),wallet=createWallet({storage:disk});
  assert.deepEqual(wallet.grantReward('piano:scale',60),{ok:true,alreadyClaimed:false,amount:60,balance:210});
  assert.deepEqual(wallet.grantReward('piano:scale',60),{ok:true,alreadyClaimed:true,amount:0,balance:210});
  const loaded=createWallet({storage:disk});assert.equal(loaded.grantReward('piano:scale',60).amount,0);
  for(const [id,amount] of [['',60],['<script>',60],['valid',-1],['valid',NaN],['valid',2.5],['valid',1001]])assert.equal(loaded.grantReward(id,amount).ok,false);
  assert.equal(loaded.snapshot().balance,210);
});

function levelProof(disk,xp){
 const events=[];let remaining=xp;
 while(remaining){const amount=Math.min(remaining,1000);events.push({id:'quest:wallet-level-'+events.length,xp:amount});remaining-=amount;}
 disk.setItem('codaPlayerProgressV1',JSON.stringify({version:1,xp,events,bestPitchLevel:0}));
}
test('large level prizes require the exact catalog amount and reached saved XP threshold',()=>{
 const disk=storage(),wallet=createWallet({storage:disk});
 for(const [id,amount]of [['level-prize:50',6000],['level-prize:10',1000],['level-prize:2',100],['level-prize:050',6000],['ordinary-reward',6000]])assert.equal(wallet.grantReward(id,amount).ok,false);
 assert.equal(wallet.snapshot().balance,150);
 levelProof(disk,60949);assert.equal(wallet.grantReward('level-prize:50',6000).ok,false);
 levelProof(disk,60950);
 assert.equal(wallet.grantReward('level-prize:50',6001).ok,false);assert.equal(wallet.grantReward('level-prize:50',1000).ok,false);
 assert.deepEqual(wallet.grantReward('level-prize:50',6000),{ok:true,alreadyClaimed:false,amount:6000,balance:6150});
 assert.equal(createWallet({storage:disk}).grantReward('level-prize:50',6000).alreadyClaimed,true);
 assert.equal(wallet.grantReward('ordinary-reward',1001).ok,false);assert.equal(wallet.grantReward('ordinary-reward',1000).ok,true);
});
test('claimed level rewards cannot rely on a forged XP total without its earned event journal',()=>{
 const disk=storage(),wallet=createWallet({storage:disk});
 disk.setItem('codaPlayerProgressV1',JSON.stringify({version:1,xp:60950,events:[]}));
 assert.equal(wallet.grantReward('level-prize:50',6000).ok,false);assert.equal(wallet.snapshot().balance,150);
 levelProof(disk,60950);const corrupted=JSON.parse(disk.getItem('codaPlayerProgressV1'));corrupted.xp++;
 disk.setItem('codaPlayerProgressV1',JSON.stringify(corrupted));assert.equal(wallet.grantReward('level-prize:50',6000).ok,false);
});
test('a browser wallet looks up progression when granting rather than requiring script load order',()=>{
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../notes-shop.js'),'utf8'),sandbox);
 const disk=storage(),wallet=sandbox.window.CodaNotesShop.createWallet({storage:disk});levelProof(disk,60950);
 assert.equal(wallet.grantReward('level-prize:50',6000).ok,false);
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../player-progression.js'),'utf8'),sandbox);
 assert.equal(wallet.grantReward('level-prize:50',6000).ok,true);assert.equal(wallet.snapshot().balance,6150);
});
test('already equipped cosmetics are grandfathered without changing the profile or balance',()=>{
  const disk=storage(),profile={name:'Collector',headwear:'wizard',eyewear:'cybervisor',accessory:'wand',shoes:'rollerskates',emote:'moonwalk',walked:900};
  const before=JSON.stringify(profile),wallet=createWallet({storage:disk,getAvatar:()=>profile});
  for(const id of ['wizard','cybervisor','wand','rollerskates','moonwalk'])assert.equal(wallet.owns(id),true,id);
  assert.equal(wallet.snapshot().balance,150);assert.equal(JSON.stringify(profile),before);
  assert.equal(wallet.owns('witch'),false);assert.equal(wallet.isStock('headphones'),false);
  assert.equal(wallet.preserveEquipped({headwear:'witch'}).ok,true);
  assert.equal(wallet.owns('witch'),true,'A profile loaded later from cloud can retain its saved cosmetic');
  assert.equal(wallet.snapshot().balance,150);assert.equal(wallet.preserveEquipped({headwear:'witch'}).changed,false);
});
test('independent wallets refresh the same ledger before spending or rewarding',()=>{
  const disk=storage(),a=createWallet({storage:disk}),b=createWallet({storage:disk});
  assert.equal(a.buy('wizard').balance,60);
  assert.equal(b.buy('cowboy').balance,0,'A second tab cannot spend a stale starter balance');
  assert.equal(a.buy('witch').ok,false);
  assert.equal(a.grantReward('piano:ode',75).balance,75);
  assert.equal(b.grantReward('piano:ode',75).alreadyClaimed,true);
  assert.equal(b.snapshot().balance,75);
});
test('wallet snapshots cannot mutate saved state and subscriber failures do not undo transactions',()=>{
  const wallet=createWallet({storage:storage()});let updates=0;
  wallet.subscribe(()=>{updates++;throw new Error('unrelated UI failure');});
  const stop=wallet.subscribe(value=>{value.owned.push('wizard');value.rewards.push('fake');});
  assert.equal(wallet.buy('witch').ok,true);assert.equal(updates,1);assert.equal(wallet.owns('wizard'),false);
  assert.deepEqual(wallet.snapshot().rewards,[]);stop();
  const view=wallet.snapshot();view.owned.length=0;view.balance=10000;
  assert.equal(wallet.owns('witch'),true);assert.equal(wallet.snapshot().balance,70);
});
test('every shop item is an actual renderer choice in its equipment slot',()=>{
  const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../character-renderer.js'),'utf8'),sandbox);
  const renderer=sandbox.window.createCodaCharacterRenderer(),slots={form:'forms',pet:'pets',visitor:'visitors',headwear:'headwear',eyewear:'eyewear',accessory:'accessories',shoes:'shoes',emote:'emotes'};
  assert.equal(new Set(STOCK.map(item=>item.id)).size,STOCK.length);
  for(const item of STOCK){assert.ok(renderer.catalog[slots[item.slot]].some(choice=>choice.id===item.id),item.id);assert.ok(item.price>0&&item.price<=12000);}
});
test('coin denominations make exact change in sixteenth-note units',()=>{
  for(const value of [0,1,2,3,4,8,15,16,35,70,150,999999]){
    const coins=denominationBreakdown(value);assert.deepEqual(coins.map(coin=>coin.value),[16,8,4,2,1]);
    assert.equal(coins.reduce((sum,coin)=>sum+coin.count*coin.value,0),value);
    for(const coin of coins){assert.ok(Number.isSafeInteger(coin.count)&&coin.count>=0);assert.match(coinSVG(coin.id),/^<svg/);}
  }
  assert.deepEqual(denominationBreakdown(150).map(coin=>coin.count),[9,0,1,1,0]);
  assert.equal(coinSVG('not-a-note'),'');
});
test('the live catalog locks about ninety percent of cosmetics and stocks newly rendered props',()=>{
  const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../character-renderer.js'),'utf8'),sandbox);
  const renderer=sandbox.window.createCodaCharacterRenderer(),catalog=renderer.catalog;
  const all=['forms','pets','headwear','eyewear','accessories','shoes','emotes'].flatMap(group=>Array.from(catalog[group]).filter(item=>item.id!=='none'&&item.id!=='human'));
  const disk=storage(),wallet=createWallet({storage:disk,catalog});
  const achievementIds=require('../player-progression.js').ACHIEVEMENT_REWARDS.map(item=>item.id);
  const locked=all.filter(item=>wallet.isStock(item.id)||['bowtie','starclip','partyglasses','halo',...achievementIds].includes(item.id)).length;
  assert.ok(locked/all.length>=.88&&locked/all.length<.96,'Premium/achievement percentage should be about ninety: '+locked+'/'+all.length);
  for(const id of ['cap','beanie','glasses','sunglasses','bow','headphones','sneakers','boots','wave','dance'])assert.equal(wallet.isStock(id),false,id);
  const newWallet=createWallet({storage:disk,catalog:{...catalog,accessories:[...catalog.accessories,{id:'new-prop',label:'A new drawn prop'}]}});
  assert.equal(newWallet.isStock('new-prop'),true);
  assert.equal(newWallet.buy('new-prop').ok,true);
  assert.equal(createWallet({storage:disk,catalog:{...catalog,accessories:[...catalog.accessories,{id:'new-prop',label:'A new drawn prop'}]}}).owns('new-prop'),true);
});

class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.style={};this.value='';this.textContent='';this.isConnected=true;this.classList={toggle(){}};}
  setAttribute(key,value){this.attributes[key]=String(value);}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  getContext(){return {};}
  focus(){}
  querySelector(selector){if(selector.startsWith('[data-shop-item=')){const id=selector.split('"')[1];return this.children.find(child=>child.attributes['data-shop-item']===id)?.children.find(child=>child.tagName==='button');}return null;}
}
test('the shop buys without changing the avatar, then explicitly equips the owned item',()=>{
  const oldDocument=global.document;global.document={createElement:tag=>new Element(tag)};
  try{
    const wallet=createWallet({storage:storage()}),body=new Element('div'),avatar={headwear:'none',name:'Guest'};let saved=0,wardrobe=0;
    const ui=createShopUI({wallet,panelBody:body,renderer:{drawPlayer(){}},getAvatar:()=>avatar,
      openPanel(){body.replaceChildren();},openWardrobe(){wardrobe++;},applyAvatar(next){Object.assign(avatar,next);saved++;return true;}});
    const all=()=>{const result=[];function visit(node){result.push(node);node.children.forEach(visit);}visit(body);return result;};
    const label=name=>all().find(node=>node.attributes['aria-label']===name);
    ui.open();label('Search shop').value='witch';label('Search shop').oninput();
    label('Buy Crooked witch hat for 80 Notes').onclick();assert.equal(wallet.snapshot().balance,70);
    assert.equal(avatar.headwear,'none');assert.equal(saved,0);
    label('Wear Crooked witch hat').onclick();assert.equal(avatar.headwear,'witch');assert.equal(saved,1);
    const status=all().find(node=>node.attributes.role==='status');assert.match(status.textContent,/Now wearing/);
    all().find(node=>node.textContent==='Open my wardrobe').onclick();assert.equal(wardrobe,1);
  }finally{global.document=oldDocument;}
});


test('aspirational rewards cost thousands, cannot overspend, and never equip themselves',()=>{
 const disk=storage(),avatar={form:'human',pet:'none'},wallet=createWallet({storage:disk,getAvatar:()=>avatar});
 for(const [id,price]of [['alien',12000],['cosmiccat',6000],['neondragon',9000]]){
  assert.equal(wallet.stock.find(item=>item.id===id).price,price);assert.equal(wallet.buy(id).ok,false);
 }
 assert.deepEqual(avatar,{form:'human',pet:'none'});
 for(let n=0;n<12;n++)assert.equal(wallet.grantReward('long-term:'+n,1000).ok,true);
 assert.equal(wallet.buy('alien').balance,150);assert.equal(wallet.owns('alien'),true);
 assert.equal(wallet.buy('alien').alreadyOwned,true);assert.equal(wallet.snapshot().balance,150);
 assert.deepEqual(avatar,{form:'human',pet:'none'});
 const loaded=createWallet({storage:disk});assert.equal(loaded.owns('alien'),true);assert.equal(loaded.snapshot().spent,12000);
 for(const item of ['lakeotter','rhythmfox','pianophoenix','triadchampion','pitchlaurel10','pitchlaurel20','pitchlaurel30','pitchcrown40','starlight'])assert.equal(wallet.isStock(item),false,'Mastery rewards stay achievement-exclusive');
});

test('Notes shop lists only priced stock, keeping expensive purchases and excluding mastery-only rewards',()=>{
 const oldDocument=global.document;global.document={createElement:tag=>new Element(tag)};
 try{
  const wallet=createWallet({storage:storage()}),body=new Element('div');
  const ui=createShopUI({wallet,panelBody:body,renderer:{drawPlayer(){},catalog:{headwear:[{id:'triadchampion',label:'Triad champion crown'}]}},getAvatar:()=>({}),
   achievementRewards:[{id:'triadchampion',label:'Triad champion crown',achievement:'triad-hard',requirement:'Win on Hard'}],openPanel(){body.replaceChildren();},openWardrobe(){}});
  ui.open();const all=[];function visit(node){all.push(node);node.children.forEach(visit);}visit(body);
  assert.equal(all.some(node=>node.attributes['aria-label']==='Shop mastery rewards'),false);
  const cards=all.filter(node=>node.attributes['data-shop-item']);assert.ok(cards.length>0);assert.equal(cards.some(node=>node.attributes['data-shop-item']==='triadchampion'),false);
  for(const card of cards){const item=wallet.stock.find(item=>item.id===card.attributes['data-shop-item']);assert.ok(item&&item.price>0);}
  assert.ok(cards.some(node=>node.attributes['data-shop-item']==='alien'),'A distant Note-saving goal stays visible even when unaffordable');
 }finally{global.document=oldDocument;}
});


test('bound profiles keep earned equipment and canonical ownership unchanged through repeated wallet starts',()=>{
 const D=require('../classroom-profile-data.js');
 const ownershipIds=D.SCHEMA.properties.wallet.properties.owned.items.enum;
 const catalog={accessories:[{id:'watchchain',label:'Pocket watch chain'},{id:'cape',label:'Hero cape'}]};
 for(const [item,xp,owned]of [['watchchain',80,[]],['cape',720,[]],['halo',0,['halo','cap','short']]]){
  const remote=D.blank();remote.avatar.accessory=item;remote.wallet.owned=[...owned];
  remote.progression.events=xp?[{id:'game:profile-reload-fixture',xp}]:[];remote.progression.xp=xp;
  assert.equal(D.validate(remote).ok,true,item+' is a valid profile');
  const disk=storage();disk.removeItem=key=>disk.records.delete(key);
  for(let boot=0;boot<3;boot++){
   assert.equal(D.apply(disk,remote).ok,true);
   const before=new Map(disk.records);
   const wallet=createWallet({storage:disk,catalog,ownershipIds,preserveEquipped:false,getAvatar:()=>JSON.parse(disk.getItem(D.KEYS.avatar))});
   assert.deepEqual(disk.records,before,'Construction must not rewrite a restored player');
   assert.equal(wallet.preserveEquipped({accessory:'cape'}).changed,false,'Strict profile wallets cannot grandfather ownership later');
   wallet.refresh();assert.deepEqual(D.capture(disk).data,remote,'Resuming must converge on the same complete DTO');
   assert.deepEqual(wallet.snapshot().owned,owned);
  }
 }
});

test('canonical non-stock ownership survives real purchases and rewards without becoming shop stock',()=>{
 const D=require('../classroom-profile-data.js'),disk=storage();disk.removeItem=key=>disk.records.delete(key);
 const remote=D.blank();remote.wallet.owned=['halo','cap','short'];assert.equal(D.apply(disk,remote).ok,true);
 const wallet=createWallet({storage:disk,preserveEquipped:false,ownershipIds:D.SCHEMA.properties.wallet.properties.owned.items.enum});
 assert.equal(wallet.isStock('halo'),false);assert.equal(wallet.buy('halo').ok,false);
 assert.equal(wallet.buy('witch').ok,true);assert.equal(wallet.grantReward('game:kept-ownership',16).ok,true);
 assert.deepEqual(wallet.snapshot().owned,['halo','cap','short','witch']);
 const reloaded=createWallet({storage:disk,preserveEquipped:false,ownershipIds:D.SCHEMA.properties.wallet.properties.owned.items.enum});
 assert.deepEqual(reloaded.snapshot().owned,['halo','cap','short','witch']);
 const saved=D.capture(disk);assert.equal(saved.ok,true);assert.equal(saved.data.wallet.balance,86);
 assert.equal(saved.data.wallet.earned,166);assert.equal(saved.data.wallet.spent,80);
});

test('ownership allowlists do not make unknown items purchasable or bypass private DTO validation',()=>{
 const D=require('../classroom-profile-data.js'),disk=storage();
 disk.setItem(KEY,JSON.stringify({version:1,balance:150,earned:150,spent:0,rewards:[],owned:['unknown-item','<private name>','a'.repeat(81),'halo']}));
 const wallet=createWallet({storage:disk,preserveEquipped:false,ownershipIds:['unknown-item','<private name>','a'.repeat(81),null,{},123]});
 assert.deepEqual(wallet.snapshot().owned,['unknown-item','halo']);
 assert.equal(wallet.buy('unknown-item').ok,false);assert.equal(wallet.isStock('unknown-item'),false);
 assert.equal(wallet.buy('witch').ok,true);
 const raw=D.blank();raw.wallet.owned=wallet.snapshot().owned;assert.equal(D.validate(raw).ok,false,'Cloud ownership remains the closed canonical enum');
});
