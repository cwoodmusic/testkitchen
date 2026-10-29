const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.style={};this.classList={add(){}};this.value='';this.textContent='';}
  setAttribute(name,value){this.attributes[name]=String(value);}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  insertBefore(node,before){const at=this.children.indexOf(before);node.parentElement=this;this.children.splice(at<0?this.children.length:at,0,node);}
  replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this.append(...nodes);}
  dispatchEvent(){}
}
const defaults={name:'Guest',hairstyle:'bald',outfit:'pants',skin:'#e5ad75',hair:'#171424',shirt:'#999ca6',lowerColor:'#626875',headwear:'none',eyewear:'none',accessory:'none',shoes:'sneakers',emote:'wave'};
function setup(options={}){
  const body=new Element('div'),profiles={player:{name:'Guest',collectedTokens:7,...options.player},miles:{name:'Miles Davis',skin:'#875b40',outfit:'suit'}};
  const calls=[];let preview,closed=0;
  const sandbox={window:{},document:{createElement:tag=>new Element(tag)},Event:class{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../boutique-ui.js'),'utf8'),sandbox);
  const ui=sandbox.window.createCodaBoutiqueUI({
    panelBody:body,renderer:{normalizeProfile:p=>({...defaults,...p}),catalog:options.catalog},
    openPanel(){body.replaceChildren();},closePanel(){closed++;},
    getTargets:()=>[{id:'player',label:'Your avatar'},{id:'miles',label:'Miles Davis'}],getProfile:id=>profiles[id],
    applyProfile(id,draft){calls.push({id,draft});if(options.failure)return false;profiles[id]={...profiles[id],...draft};return true;},
    getPreviewUI:()=>({addPreview:getter=>{preview=getter;}}),unlocked:options.unlocked||(()=>true),lockedReason:options.lockedReason,isDeveloperMode:()=>options.developer===true,refreshUnlocks:options.refreshUnlocks
  });
  const all=()=>{const nodes=[];function visit(node){nodes.push(node);node.children.forEach(visit);}visit(body);return nodes;};
  return {ui,avatarDefaults:sandbox.window.CodaAvatarDefaults,body,profiles,calls,all,label:name=>all().find(node=>node.attributes['aria-label']===name),button:name=>all().find(node=>node.tagName==='button'&&node.textContent===name),get preview(){return preview();},get closed(){return closed;}};
}

test('legacy single-slot equipment migrates only when modern slots are absent',()=>{
  const env=setup();
  assert.equal(env.ui.migrateProfile({accessory:'cap'}).headwear,'cap');
  assert.equal(env.ui.migrateProfile({accessory:'cap'}).accessory,'none');
  assert.equal(env.ui.migrateProfile({accessory:'partyglasses'}).eyewear,'partyglasses');
  assert.equal(env.ui.migrateProfile({accessory:'partyglasses'}).accessory,'none');
  assert.equal(env.ui.migrateProfile({accessory:'cap',headwear:'none'}).headwear,'none');
  const raw={accessory:'sunglasses'},before=JSON.stringify(raw);env.ui.migrateProfile(raw);assert.equal(JSON.stringify(raw),before);
});

test('player preview combines independent hats, glasses, accessories and colors without committing a draft',()=>{
  const env=setup();env.ui.open();
  env.label('Hats').value='cap';env.label('Glasses').value='sunglasses';env.label('Accessories').value='headphones';env.label('Lower clothing color').value='#112233';
  assert.equal(env.preview.headwear,'cap');assert.equal(env.preview.eyewear,'sunglasses');assert.equal(env.preview.accessory,'headphones');assert.equal(env.preview.lowerColor,'#112233');
  assert.equal(env.calls.length,0);assert.equal(env.profiles.player.headwear,undefined);
  env.button('Save my look').onclick();
  assert.equal(env.calls.length,1);assert.equal(env.calls[0].id,'player');assert.equal(env.profiles.player.headwear,'cap');assert.equal(env.profiles.player.eyewear,'sunglasses');assert.equal(env.profiles.player.accessory,'headphones');assert.equal(env.profiles.player.collectedTokens,7);assert.equal(env.closed,1);
});

test('the plain base is bald and gray without changing a saved look until Save',()=>{
  const env=setup({developer:true,player:{name:'Improviser',avatarId:'player-42',headwear:'crown',hairstyle:'buns',shirt:'#abcdef',lowerColor:'#123456',accessory:'bow'}}),before=JSON.stringify(env.profiles.player);
  env.ui.open();env.button('Plain base avatar').onclick();
  assert.equal(env.preview.hairstyle,'bald');assert.equal(env.preview.headwear,'none');assert.equal(env.preview.eyewear,'none');assert.equal(env.preview.accessory,'none');
  assert.equal(env.preview.shirt,'#999ca6');assert.equal(env.preview.lowerColor,'#626875');assert.equal(env.preview.name,'Improviser');
  assert.equal(JSON.stringify(env.profiles.player),before);assert.equal(env.calls.length,0);
  env.button('Save my look').onclick();assert.equal(env.profiles.player.hairstyle,'bald');assert.equal(env.profiles.player.headwear,'none');
  assert.equal(env.profiles.player.avatarId,'player-42');assert.equal(env.profiles.player.collectedTokens,7);
  env.ui.open('miles');assert.equal(env.button('Plain base avatar'),undefined);
});

test('only recognizable system defaults migrate; explicit hats and progress remain intact',()=>{
  const env=setup(),{plain,classic,migrate}=env.avatarDefaults;
  const old={...classic,customized:false,name:'Keeper',walked:860,collectedTokens:7,visited:[0,2]},before=JSON.stringify(old),next=migrate(old);
  assert.equal(JSON.stringify(old),before,'Migration must not mutate a loaded profile');
  for(const key of ['hairstyle','shirt','lowerColor','headwear','accessory'])assert.equal(next[key],plain[key]);
  assert.equal(next.name,'Keeper');assert.equal(next.walked,860);assert.equal(next.collectedTokens,7);assert.equal(JSON.stringify(next.visited),'[0,2]');
  assert.equal(migrate({...classic,customized:true}).headwear,'cap','Explicitly saved cap choice wins');
  assert.equal(migrate({...classic}).headwear,'cap','An ambiguous explicit cap is preserved');
  assert.equal(migrate({customized:false,headwear:'cap'}).headwear,'none','A partial old system-default record also loses its implicit cap');
  assert.equal(JSON.stringify(migrate(next)),JSON.stringify(next),'Default migration is idempotent');
  assert.equal(migrate({...old,headwear:'beanie'}).headwear,'beanie');
  assert.equal(migrate({...old,shirt:'#abcdef'}).shirt,'#abcdef','A different costume is not an automatic default');
  const guest={hairstyle:'short',outfit:'pants',skin:'#d49a76',hair:'#463145',shirt:'#a7f66f',accessory:'none',walked:125};
  assert.equal(migrate(guest).hairstyle,'bald');assert.equal(migrate(guest).walked,125);
  assert.equal(migrate({...guest,lowerColor:'#abcdef'}).lowerColor,'#abcdef','An explicit lower-clothing color is preserved');
  assert.equal(migrate({...guest,accessory:'cap'}).accessory,'cap','Legacy single-slot equipment remains explicit');
  assert.equal(migrate({...guest,accessory:'cap'}).headwear,'cap','A legacy cap remains equipped across partial profile merges');
  assert.equal(migrate({accessory:'sunglasses'}).eyewear,'sunglasses');
});

test('classic cap look is an optional player draft and preserves identity and progress',()=>{
  const env=setup({developer:true,player:{name:'Improviser',avatarId:'player-42',hairstyle:'buns',hair:'#abcdef',skin:'#704633',outfit:'dress',shirt:'#d69cff',lowerColor:'#34313a',headwear:'crown',eyewear:'glasses',accessory:'bow',shoes:'boots',emote:'dance'}});
  const before=JSON.stringify(env.profiles.player);
  const expected={hairstyle:'short',hair:'#171424',skin:'#e5ad75',outfit:'pants',shirt:'#e94038',lowerColor:'#235cb9',headwear:'cap',eyewear:'none',accessory:'none',shoes:'sneakers',emote:'wave'};
  env.ui.open();env.label('Arcade nickname').value='New nickname';env.button('Classic cap look').onclick();
  for(const [key,value] of Object.entries(expected))assert.equal(env.preview[key],value,key);
  assert.equal(env.preview.name,'New nickname');assert.equal(env.calls.length,0);assert.equal(JSON.stringify(env.profiles.player),before);
  env.button('Cancel').onclick();env.ui.open();
  assert.equal(env.preview.name,'Improviser');assert.equal(env.preview.outfit,'dress');assert.equal(env.preview.headwear,'crown');
  env.button('Classic cap look').onclick();env.button('Save my look').onclick();
  for(const [key,value] of Object.entries(expected))assert.equal(env.profiles.player[key],value,key);
  assert.equal(env.calls.length,1);assert.equal(env.profiles.player.name,'Improviser');assert.equal(env.profiles.player.avatarId,'player-42');assert.equal(env.profiles.player.collectedTokens,7);
  env.ui.open('miles');assert.equal(env.button('Classic cap look'),undefined);assert.equal(env.preview.name,'Miles Davis');assert.equal(env.preview.outfit,'suit');
});

test('locked items are disabled and never enter an avatar preview or save',()=>{
  const env=setup({unlocked:id=>!['partyglasses','halo'].includes(id)});env.ui.open();
  env.label('Glasses').value='partyglasses';assert.equal(env.preview.eyewear,'none');env.button('Save my look').onclick();
  assert.equal(env.calls.length,0);assert.match(env.all().find(node=>node.className==='panelMsg').textContent,/Still locked: Party glasses/);
  env.label('Glasses').value='none';env.label('Accessories').value='halo';assert.equal(env.preview.accessory,'none');env.button('Save my look').onclick();assert.equal(env.calls.length,0);assert.match(env.all().find(node=>node.className==='panelMsg').textContent,/Neon halo/);
  env.label('Accessories').value='none';env.button('Save my look').onclick();assert.equal(env.calls.length,1);
});

test('explicit developer NPC styling retains musician identity and its editing exception',()=>{
  const env=setup({developer:true,unlocked:()=>false});env.ui.open('miles');
  const name=env.label('Arcade nickname');assert.equal(name.readOnly,true);name.value='Different person';
  env.label('Hats').value='crown';env.label('Glasses').value='partyglasses';env.label('Accessories').value='halo';env.button('Save NPC look').onclick();
  assert.equal(env.calls.length,1);assert.equal(env.calls[0].id,'miles');assert.equal(env.calls[0].draft.name,'Miles Davis');assert.equal(env.profiles.miles.headwear,'crown');assert.equal(env.profiles.player.headwear,undefined);
});

test('switching targets and cancelling discard unsaved drafts rather than changing another character',()=>{
  const env=setup({developer:true});env.ui.open();env.label('Hair color').value='#ffffff';
  const target=env.label('Customize');target.value='miles';target.onchange();assert.equal(env.ui.getTarget(),'miles');assert.equal(env.calls.length,0);assert.equal(env.profiles.player.hair,undefined);
  env.button('Cancel').onclick();assert.equal(env.closed,1);assert.equal(env.calls.length,0);
  env.ui.open();assert.equal(env.preview.hair,defaults.hair);
});

test('a failed save keeps the draft available and does not close the boutique',()=>{
  const env=setup({failure:true});env.ui.open();env.label('Hats').value='beanie';env.button('Save my look').onclick();
  assert.equal(env.closed,0);assert.equal(env.ui.getDraft().headwear,'beanie');assert.match(env.all().find(node=>node.className==='panelMsg').textContent,/could not be saved/);
});

test('wardrobe categories and search preview fantasy choices without changing saved equipment',()=>{
  const env=setup({catalog:{headwear:[{id:'none',label:'None'},{id:'witch',label:'Witch hat'},{id:'wizard',label:'Wizard hat'}],eyewear:[{id:'none',label:'None'},{id:'cateye',label:'Cat-eye glasses'}]}});
  env.ui.open();const before=JSON.stringify(env.profiles.player),search=env.label('Search wardrobe');
  search.value='witch';search.oninput();
  assert.ok(env.label('Try Witch hat'));assert.equal(env.label('Try Wizard hat'),undefined);
  env.label('Try Witch hat').onclick();assert.equal(env.preview.headwear,'witch');
  assert.equal(JSON.stringify(env.profiles.player),before,'Browsing and trying items remain a draft');
  search.value='wizard';search.oninput();assert.equal(env.preview.headwear,'witch','Filtering must not silently change the equipped draft');
  env.label('Try Wizard hat').onclick();assert.equal(env.preview.headwear,'wizard');
  env.button('Glasses').onclick();assert.equal(search.value,'');env.label('Try Cat-eye glasses').onclick();
  assert.equal(env.preview.headwear,'wizard');assert.equal(env.preview.eyewear,'cateye');
  env.button('Save my look').onclick();assert.equal(env.profiles.player.headwear,'wizard');assert.equal(env.profiles.player.eyewear,'cateye');
});

test('hat and glasses colors save with independent equipment and remain draft-only until save',()=>{
  const env=setup({player:{headwear:'beanie',headwearColor:'#123456',eyewear:'glasses',eyewearColor:'#654321'}});env.ui.open();
  assert.equal(env.label('Hat color').value,'#123456');assert.equal(env.label('Glasses color').value,'#654321');
  env.label('Hat color').value='#cc5599';env.label('Glasses color').value='#55bbee';
  assert.equal(env.preview.headwearColor,'#cc5599');assert.equal(env.preview.eyewearColor,'#55bbee');
  assert.equal(env.profiles.player.headwearColor,'#123456');env.button('Save my look').onclick();
  assert.equal(env.profiles.player.headwearColor,'#cc5599');assert.equal(env.profiles.player.eyewearColor,'#55bbee');
});

test('NPC preview retains its character identity while its costume remains independently editable',()=>{
  const env=setup({developer:true});env.ui.open('miles');
  assert.equal(env.preview.characterId,'miles');assert.equal(env.preview.name,'Miles Davis');
  env.ui.open();assert.equal(env.preview.characterId,undefined);
});

test('locked tiles show the item name and requirement and ignore even direct activation',()=>{
 const env=setup({unlocked:id=>id!=='wizard',lockedReason:()=> 'Buy with 120 Notes',catalog:{headwear:[{id:'none',label:'None'},{id:'wizard',label:'Wizard hat'}]}});env.ui.open();
 const item=env.label('Locked: Wizard hat. Buy with 120 Notes');assert.ok(item);assert.equal(item.disabled,true);assert.match(item.className,/is-locked/);
 const option=env.label('Hats').children.find(node=>node.value==='wizard');assert.equal(option.disabled,true);assert.match(option.textContent,/🔒 Wizard hat/);
 item.onclick();assert.equal(env.preview.headwear,'none');assert.equal(env.label('Hats').value,'none');assert.match(env.all().find(node=>node.className==='panelMsg').textContent,/Wizard hat/);
});

test('newly earned items refresh without resetting another chosen piece of the look',()=>{
 const owned=new Set(['none','cap']);const env=setup({unlocked:id=>id!=='wizard'||owned.has(id),catalog:{headwear:[{id:'none',label:'None'},{id:'cap',label:'Cap'},{id:'wizard',label:'Wizard hat'}]}});env.ui.open();
 env.label('Try Cap').onclick();env.label('Glasses').value='glasses';assert.equal(env.preview.headwear,'cap');
 owned.add('wizard');env.ui.refresh();
 const option=env.label('Hats').children.find(node=>node.value==='wizard');assert.equal(option.disabled,false);assert.equal(env.preview.headwear,'cap');assert.equal(env.preview.eyewear,'glasses');
 env.label('Try Wizard hat').onclick();assert.equal(env.preview.headwear,'wizard');assert.equal(env.preview.eyewear,'glasses');env.button('Save my look').onclick();assert.equal(env.calls.length,1);
});

test('normal boutique has no NPC styling shortcut and developer privilege is checked again at Save',()=>{
 const env=setup();env.ui.open('miles');assert.equal(env.ui.getTarget(),'player');assert.deepEqual(env.label('Customize').children.map(node=>node.value),['player']);assert.equal(env.preview.characterId,undefined);
 const options={developer:true};const dev=setup(options);dev.ui.open('miles');assert.equal(dev.ui.getTarget(),'miles');options.developer=false;dev.button('Save NPC look').onclick();assert.equal(dev.calls.length,0);assert.match(dev.all().find(node=>node.className==='panelMsg').textContent,/Developer mode/);
});

test('preview fallbacks are revalidated after an unlock or developer privilege is revoked',()=>{
 const locked=new Set();const env=setup({unlocked:id=>!locked.has(id)});env.ui.open();
 env.label('Hats').value='cap';env.label('Glasses').value='sunglasses';assert.equal(env.preview.headwear,'cap');
 locked.add('cap');env.ui.refresh();assert.equal(env.preview.headwear,'none');assert.equal(env.preview.eyewear,'sunglasses');
 env.label('Hats').onchange();assert.equal(env.label('Hats').value,'none');
 const options={developer:true,unlocked:id=>id!=='crown'};const dev=setup(options);dev.ui.open('miles');
 dev.label('Hats').value='crown';assert.equal(dev.preview.headwear,'crown');options.developer=false;dev.ui.refresh();
 assert.equal(dev.preview.headwear,'none');dev.button('Save NPC look').onclick();assert.equal(dev.calls.length,0);
});
