/* Notes are the arcade's local, play-earned currency. No payments or services. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CodaNotesShop=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const KEY='codaNotesWalletV1',STARTER_NOTES=150,MAX_BALANCE=1000000;
  const DENOMINATIONS=Object.freeze([
    {id:'whole',label:'Whole note',value:16},{id:'half',label:'Half note',value:8},
    {id:'quarter',label:'Quarter note',value:4},{id:'eighth',label:'Eighth note',value:2},
    {id:'sixteenth',label:'Sixteenth note',value:1}
  ].map(Object.freeze));
  function gameReward(game,result){
    if(!result||typeof result!=='object')return 0;
    if(game==='triad'&&['computer','multiplayer','advanced'].includes(result.mode)&&typeof result.won==='boolean')return result.won?16:4;
    if(game==='pitch'&&Number.isSafeInteger(result.correct)&&result.correct>0&&typeof result.won==='boolean')return result.won?16:8;
    if(game==='rhythm'&&Number.isSafeInteger(result.total)&&result.total>0&&Number.isSafeInteger(result.hits)&&result.hits>0&&result.hits<=result.total&&Number.isSafeInteger(result.extra)&&result.extra>=0)
      return Math.max(1,Math.min(16,Math.floor(16*result.hits/(result.total+result.extra))));
    return 0;
  }
  function denominationBreakdown(balance){
    let remaining=Number.isSafeInteger(balance)&&balance>=0?balance:0;
    return DENOMINATIONS.map(coin=>{const count=Math.floor(remaining/coin.value);remaining%=coin.value;return {...coin,count};});
  }
  function coinSVG(id){
    if(!DENOMINATIONS.some(coin=>coin.id===id))return '';
    const head=id==='whole'?'<ellipse cx="16" cy="23" rx="8" ry="4.5" transform="rotate(-15 16 23)" fill="none" stroke="currentColor" stroke-width="3"/>':
      '<ellipse cx="13" cy="25" rx="6.5" ry="4.5" transform="rotate(-20 13 25)" '+(id==='half'?'fill="none" stroke="currentColor" stroke-width="2.5"':'fill="currentColor"')+'/>';
    const stem=id==='whole'?'':'<path d="M19 24V5" fill="none" stroke="currentColor" stroke-width="2.5"/>';
    const flags=['eighth','sixteenth'].includes(id)?'<path d="M19 5C21 10 30 10 24 18C25 12 20 13 19 11Z" fill="currentColor"/>':'';
    const second=id==='sixteenth'?'<path d="M19 11C21 16 30 16 24 24C25 18 20 19 19 17Z" fill="currentColor"/>':'';
    return '<svg viewBox="0 0 32 36" aria-hidden="true" focusable="false">'+head+stem+flags+second+'</svg>';
  }
  const STOCK=Object.freeze([
    ['witch','headwear','Crooked witch hat',80],['wizard','headwear','Starry wizard hat',90],
    ['cowboy','headwear','Cowboy hat',60],['tophat','headwear','Top hat',70],
    ['pirate','headwear','Pirate tricorn',80],['astronaut','headwear','Space helmet',120],
    ['flowercrown','headwear','Flower crown',50],['tiara','headwear','Tiara',100],
    ['viking','headwear','Horned helmet',80],['cat','headwear','Cat ears',40],
    ['bunny','headwear','Bunny ears',40],['heartglasses','eyewear','Heart glasses',45],
    ['starglasses','eyewear','Star glasses',50],['steampunk','eyewear','Clockwork goggles',80],
    ['cybervisor','eyewear','Cyber visor',100],['monocle','eyewear','Monocle',45],
    ['cape','accessory','Hero cape',70],['wings','accessory','Angel wings',120],
    ['wand','accessory','Magic wand',60],['guitar','accessory','Electric guitar',100],
    ['saxophone','accessory','Saxophone',110],['boombox','accessory','Boombox',90],
    ['teddy','accessory','Teddy bear',40],['platforms','shoes','Platform boots',65],
    ['rollerskates','shoes','Roller skates',90],['iceskates','shoes','Ice skates',80],
    ['clown','shoes','Clown shoes',50],['airguitar','emote','Air guitar',50],
    ['moonwalk','emote','Moonwalk',90],['breakdance','emote','Breakdance',110],
    ['alien','form','Alien transformation',12000],['cosmiccat','pet','Cosmic cat companion',6000],['neondragon','pet','Neon dragon companion',9000],['celestialcrown','headwear','Celestial crown',4000],['nebulaaura','accessory','Nebula aura',3000],
    ['visitor-vee-jay','visitor','Invite Vee Jay',6000],['visitor-zizi','visitor','Invite Zizi',8000],['visitor-metronome','visitor','Invite Metronome',10000]
  ].map(([id,slot,label,price])=>Object.freeze({id,slot,label,price})));
  const stock=new Map(STOCK.map(item=>[item.id,item]));
  const FREE_ITEMS=new Set(['none','human','cap','beanie','glasses','sunglasses','bow','headphones','sneakers','boots','wave','dance']);
  const ACHIEVEMENT_ITEMS=new Set(['bowtie','starclip','partyglasses','halo','lakeotter','rhythmfox','pianophoenix','triadchampion','pitchlaurel10','pitchlaurel20','pitchlaurel30','pitchcrown40','starlight','bassclefpin','basslaurel','grandstaffbadge','grandstaffcrown']);
  function stockForCatalog(catalog){
    if(!catalog||typeof catalog!=='object')return STOCK;
    const result=[],seen=new Set(),groups={forms:'form',pets:'pet',visitors:'visitor',headwear:'headwear',eyewear:'eyewear',accessories:'accessory',shoes:'shoes',emotes:'emote'};
    for(const [key,slot]of Object.entries(groups))for(const item of catalog[key]||[]){
      if(!item||typeof item.id!=='string'||typeof item.label!=='string'||FREE_ITEMS.has(item.id)||ACHIEVEMENT_ITEMS.has(item.id)||seen.has(item.id))continue;
      const price=stock.get(item.id)?.price||({headwear:60,eyewear:45,accessory:65,shoes:55,emote:50}[slot]+(item.id.length%4)*10);
      result.push(Object.freeze({id:item.id,slot,label:item.label,price}));seen.add(item.id);
    }
    return Object.freeze(result);
  }
  const integer=(value,fallback=0)=>Number.isSafeInteger(value)&&value>=0?Math.min(MAX_BALANCE,value):fallback;
  const unique=values=>Array.from(new Set(values));
  const copy=state=>({...state,owned:[...state.owned],rewards:[...state.rewards]});
  function clean(raw,validStock=stock){
    if(!raw||raw.version!==1||!Number.isSafeInteger(raw.balance)||raw.balance<0||raw.balance>MAX_BALANCE||!Array.isArray(raw.owned)||!Array.isArray(raw.rewards))return null;
    return {version:1,balance:raw.balance,owned:unique(raw.owned.filter(id=>validStock.has(id))),
      rewards:unique(raw.rewards.filter(id=>typeof id==='string'&&/^[a-z0-9:_-]{1,100}$/i.test(id))),
      earned:integer(raw.earned,STARTER_NOTES),spent:integer(raw.spent)};
  }
  function createWallet(api={}){
    const collection=stockForCatalog(api.catalog),walletStock=new Map(collection.map(item=>[item.id,item]));
    // Owning an item and selling it are separate. Older saves can contain a
    // free, earned, or retired cosmetic which is absent from today's shop.
    const knownOwned=new Set([...walletStock.keys(),...FREE_ITEMS,...ACHIEVEMENT_ITEMS]);
    const ownershipId=id=>typeof id==='string'&&/^[a-z0-9:_-]{1,80}$/i.test(id);
    for(const group of Object.values(api.catalog||{}))if(Array.isArray(group))for(const item of group)if(ownershipId(item?.id))knownOwned.add(item.id);
    if(Array.isArray(api.ownershipIds))for(const id of api.ownershipIds.slice(0,256))if(ownershipId(id))knownOwned.add(id);
    const preserveLegacy=api.preserveEquipped!==false;
    let storage=api.storage;
    if(storage===undefined)try{storage=window.localStorage;}catch{}
    const listeners=new Set(),initial={version:1,balance:STARTER_NOTES,owned:[],rewards:[],earned:STARTER_NOTES,spent:0};
    if(typeof api.onChange==='function')listeners.add(api.onChange);
    let state=initial,persistent=false,lastError='';
    const read=()=>{const raw=storage?.getItem(KEY);return raw?clean(JSON.parse(raw),knownOwned):null;};
    function notify(){const value=snapshot();for(const listener of listeners)try{listener(value);}catch{/* UI listeners cannot undo a saved transaction. */}}
    function save(next){
      try{
        if(!storage||typeof storage.setItem!=='function')throw new Error('storage');
        storage.setItem(KEY,JSON.stringify(next));state=next;persistent=true;lastError='';notify();return true;
      }catch{persistent=false;lastError='Browser saving is unavailable. No Notes were spent and no purchase was saved.';notify();return false;}
    }
    function refresh(){
      try{const saved=read();if(saved){state=saved;persistent=true;lastError='';}}
      catch{persistent=false;lastError='Browser saving is unavailable. Purchases are paused.';}
      return snapshot();
    }
    let savedWallet=null;
    try{savedWallet=read();state=savedWallet||initial;}catch{state=initial;}
    // A previously equipped cosmetic remains usable when the shop is introduced.
    // Existing ownership is additive; this never alters the avatar itself.
    if(preserveLegacy){
      const avatar=api.getAvatar?.()||{};
      const legacy=collection.filter(item=>avatar[item.slot]===item.id||avatar.accessory===item.id).map(item=>item.id);
      state={...state,owned:unique([...state.owned,...legacy])};save(state);
    }else{
      // The profile service owns restoration. Rewriting a valid cloud wallet
      // during construction makes every resume look like an identity change.
      persistent=!!savedWallet;
    }
    function snapshot(){return {...copy(state),persistent,error:lastError,starterNotes:STARTER_NOTES,purse:denominationBreakdown(state.balance)};}
    function buy(id){
      const item=walletStock.get(id);if(!item)return {ok:false,error:'That item is not in the shop.'};
      refresh();
      if(state.owned.includes(id))return {ok:true,alreadyOwned:true,item,balance:state.balance};
      if(state.balance<item.price)return {ok:false,error:'You need '+(item.price-state.balance)+' more Notes.',balance:state.balance};
      const next={...state,balance:state.balance-item.price,spent:state.spent+item.price,owned:[...state.owned,id]};
      if(!save(next))return {ok:false,error:lastError,balance:state.balance};
      return {ok:true,alreadyOwned:false,item,balance:state.balance};
    }
    function grantReward(id,amount){
      if(typeof id!=='string'||!/^[a-z0-9:_-]{1,100}$/i.test(id)||!Number.isSafeInteger(amount)||amount<1)return {ok:false,error:'Invalid Notes reward.'};
      if(id.startsWith('level-prize:')){
        // Progression may load after this module. Only a real, reached prize
        // can exceed the ordinary 1,000-Note reward limit.
        let progression;try{progression=typeof window!=='undefined'&&window.CodaPlayerProgression||(typeof require==='function'?require('./player-progression.js'):null);}catch{}
        const prize=progression?.LEVEL_NOTES?.find(item=>item.id===id);let proof,raw;
        try{proof=progression?.readState(storage);raw=JSON.parse(storage?.getItem(progression?.KEY)||'null');}catch{}
        if(!prize||prize.amount!==amount||!raw||raw.xp!==proof?.xp||raw.events?.length!==proof?.eventCount||proof.xp<progression.THRESHOLDS[prize.level-1])return {ok:false,error:'Invalid Notes reward.'};
      }else if(amount>1000)return {ok:false,error:'Invalid Notes reward.'};
      refresh();
      if(state.rewards.includes(id))return {ok:true,alreadyClaimed:true,amount:0,balance:state.balance};
      if(state.rewards.length>=4096)return {ok:false,error:'The Notes reward ledger is full.'};
      const credited=Math.min(amount,MAX_BALANCE-state.balance),next={...state,balance:state.balance+credited,earned:Math.min(MAX_BALANCE,state.earned+credited),rewards:[...state.rewards,id]};
      if(!save(next))return {ok:false,error:'Browser saving is unavailable. Your Notes reward has not been saved; try again.',balance:state.balance};
      return {ok:true,alreadyClaimed:false,amount:credited,balance:state.balance};
    }
    function preserveEquipped(profile){
      if(!profile||typeof profile!=='object')return {ok:false,error:'No saved profile was supplied.'};
      if(!preserveLegacy)return {ok:true,changed:false};
      refresh();
      const existing=collection.filter(item=>profile[item.slot]===item.id||profile.accessory===item.id).map(item=>item.id);
      const owned=unique([...state.owned,...existing]);
      if(owned.length===state.owned.length)return {ok:true,changed:false};
      if(!save({...state,owned}))return {ok:false,error:lastError};
      return {ok:true,changed:true};
    }
    return {stock:collection,snapshot,refresh,buy,grantReward,preserveEquipped,reward:grantReward,isStock:id=>walletStock.has(id),owns:id=>state.owned.includes(id),
      subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);}};
  }
  function createShopUI(api){
    const {wallet,renderer,panelBody:body}=api;
    const collection=(wallet.stock||STOCK).filter(item=>Number.isSafeInteger(item.price)&&item.price>0&&!item.achievement);
    const groups=[['all','Everything'],['premium','Big goals'],['form','Transformations'],['pet','Pets'],['visitor','Visitors'],['headwear','Hats'],['eyewear','Glasses'],['accessory','Accessories'],['shoes','Shoes'],['emote','Emotes']];
    let group='all',query='',statusText='',statusBad=false;
    const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};
    const button=(label,action)=>{const element=node('button','',label);element.type='button';element.onclick=action;return element;};
    let section=null,status=null,balance=null,purse=null,results=null,search=null,categoryButtons=[];
    function message(text,bad=false){statusText=text;statusBad=bad;if(status){status.textContent=text;status.classList.toggle('notes-shop-error',bad);}}
    function render(){
      const value=wallet.snapshot();balance.textContent='♫ '+value.balance+' Notes';
      purse.replaceChildren();
      for(const coin of value.purse){
        const entry=node('div','notes-purse-coin');entry.setAttribute('role','listitem');entry.setAttribute('aria-label',coin.count+' '+coin.label.toLowerCase()+' coin'+(coin.count===1?'':'s')+', '+coin.value+' Note'+(coin.value===1?'':'s')+' each');
        const image=node('span','notes-coin-icon');image.innerHTML=coinSVG(coin.id);
        entry.append(image,node('strong','',String(coin.count)),node('small','',coin.value+' Note'+(coin.value===1?'':'s')));purse.append(entry);
      }
      const matches=collection.filter(item=>(group==='all'||item.slot===group||group==='premium'&&item.price>=1000)&&(item.label+' '+item.id).toLowerCase().includes(query));
      for(const entry of categoryButtons)entry.element.setAttribute('aria-pressed',String(entry.id===group));
      results.replaceChildren();
      if(!matches.length)results.append(node('p','muted','No matches. Try another search.'));
      for(const item of matches){
        const purchased=wallet.owns(item.id),levelUnlocked=!!api.unlocked?.(item.id),owned=purchased||levelUnlocked,card=node('article','notes-shop-card');card.setAttribute('data-shop-item',item.id);
        const canvas=node('canvas');canvas.width=128;canvas.height=144;canvas.setAttribute('aria-hidden','true');
        if(renderer?.drawPlayer){
          const avatar=api.getAvatar(),look=item.slot==='visitor'?{...avatar,form:{'visitor-vee-jay':'tv','visitor-zizi':'alien','visitor-metronome':'robot'}[item.id],hairstyle:'bald',headwear:'none',eyewear:'none',accessory:'none',...globalThis.CodaNPCVisitors?.get?.(item.id)?.appearance,pet:'none'}:renderer.itemPreviewProfile?.(avatar,item.slot,item.id)||{...avatar,[item.slot]:item.id};
          renderer.drawPlayer(canvas.getContext('2d'),look,{x:54,y:126,scale:1.45,facing:'down',walking:false,emote:item.slot==='emote'?item.id:null,emoteTime:.5,previewPet:true},.5);
        }
        const heading=node('h3','',item.label),price=node('p','notes-shop-price',owned?'Owned':item.price+' Notes');
        const action=button(item.slot==='visitor'&&owned?'Visitor invited':owned?(api.equipInBoutique?'Choose at boutique':'Wear this'):`Buy · ${item.price} Notes`,()=>{
          if(item.slot==='visitor'&&owned)return;
          if(owned){
            if(api.equipInBoutique){api.openWardrobe?.();return;}
            try{const applied=api.applyAvatar({...api.getAvatar(),[item.slot]:item.id});message(applied===false?'Your look could not be saved. Your purchase is still owned.':'Now wearing '+item.label+'.',applied===false);}catch{message('Your look could not be saved. Your purchase is still owned.',true);}
          }else{
            const result=wallet.buy(item.id);
            if(result.ok){message(item.slot==='visitor'?'Invited '+item.label.replace(/^Invite /,'')+'! They can now visit the arcade.':result.alreadyOwned?'You already own '+item.label+'.':'Bought '+item.label+'! '+(api.equipInBoutique?'Visit the boutique to wear it.':'Choose Wear this to put it on.'));render();results.querySelector('[data-shop-item="'+item.id+'"] button')?.focus({preventScroll:true});}
            else{message(result.error,true);render();}
          }
        });
        action.setAttribute('aria-label',item.slot==='visitor'&&owned?item.label+' already unlocked':owned?'Wear '+item.label:'Buy '+item.label+' for '+item.price+' Notes');
        action.disabled=item.slot==='visitor'&&owned||!owned&&(!value.persistent||value.balance<item.price);
        if(item.price>=1000){const goal=node('p','muted','A long-term reward. Earn Notes from games, quests, and catches.');card.append(canvas,heading,price,goal,action);}else card.append(canvas,heading,price,action);results.append(card);
      }
      message(statusText||(!value.persistent?'Browser saving is unavailable. Purchases are paused.':'Purchases stay in this browser. No real money is used.'),statusBad||!value.persistent);
    }
    function open(){
      wallet.refresh();group='all';query='';statusText='';statusBad=false;
      api.openPanel('Riff · Notes Shop');section=node('section','notes-shop');section.setAttribute('aria-label','Notes accessory shop');
      const intro=node('p','notes-shop-intro','Welcome! Spend Notes on a new look or invite a special visitor. You start with 150 Notes; play cabinet games and complete musician or Piano Lab quests to earn more.');
      balance=node('p','notes-shop-balance');balance.setAttribute('aria-label','Notes balance');balance.setAttribute('aria-live','polite');
      purse=node('div','notes-purse');purse.setAttribute('role','list');purse.setAttribute('aria-label','Notes coin purse');
      const toolbar=node('div','notes-shop-toolbar'),wardrobe=button(api.wardrobeLabel||'Open my wardrobe',api.openWardrobe);
      toolbar.append(balance,wardrobe);
      const categories=node('div','notes-shop-categories');categories.setAttribute('role','group');categories.setAttribute('aria-label','Shop categories');categoryButtons=[];
      for(const [id,label] of groups){const element=button(label,()=>{group=id;render();});element.setAttribute('aria-label','Shop '+label.toLowerCase());categories.append(element);categoryButtons.push({id,element});}
      const label=node('label','notes-shop-search','Find an accessory'),input=node('input');input.type='search';input.id='notesShopSearch';input.setAttribute('aria-label','Search shop');input.placeholder='Try witch, guitar, or skates';input.oninput=()=>{query=input.value.trim().toLowerCase();render();};label.append(input);search=input;
      status=node('p','notes-shop-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      results=node('div','notes-shop-results');results.setAttribute('aria-label','Accessories for sale');
      section.append(intro,toolbar,purse,categories,label,status,results);body.append(section);render();search.focus();
    }
    return {open,refresh:()=>{if(section?.isConnected)render();}};
  }
  return Object.freeze({KEY,STOCK,STARTER_NOTES,DENOMINATIONS,denominationBreakdown,coinSVG,stockForCatalog,gameReward,createWallet,createShopUI});
});
