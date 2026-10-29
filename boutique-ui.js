/* Shared player defaults and draft-only wardrobe controls. */
window.CodaAvatarDefaults=(()=>{
  const plain=Object.freeze({form:'human',pet:'none',hairstyle:'bald',hair:'#171424',skin:'#e5ad75',outfit:'pants',shirt:'#999ca6',lowerColor:'#626875',headwear:'none',eyewear:'none',accessory:'none',shoes:'sneakers',emote:'wave'});
  const classic=Object.freeze({...plain,hairstyle:'short',shirt:'#e94038',lowerColor:'#235cb9',headwear:'cap'});
  const matches=(profile,look)=>Object.entries(look).every(([key,value])=>profile[key]===undefined||(typeof value==='string'&&value.startsWith('#')?typeof profile[key]==='string'&&profile[key].toLowerCase()===value:profile[key]===value));
  function migrate(raw){
    const profile=raw&&typeof raw==='object'&&!Array.isArray(raw)?{...raw}:{};
    // An explicit customized look is never a default, even when it happens to
    // match the old preset. Old single-slot caps are deliberate equipment too.
    const oldSystemCap=profile.customized===false&&profile.headwear==='cap'&&matches(profile,classic);
    const oldGuest=profile.customized!==true&&profile.headwear===undefined&&
      profile.hairstyle==='short'&&profile.outfit==='pants'&&
      profile.skin==='#d49a76'&&profile.hair==='#463145'&&profile.shirt==='#a7f66f'&&
      matches(profile,{lowerColor:'#424258',accessory:'none',eyewear:'none',shoes:'sneakers',emote:'wave'});
    if(oldSystemCap||oldGuest)return {...profile,...plain,hat:false};
    // Preserve explicit legacy equipment when a partial cloud profile is
    // merged into a local profile that already has modern empty slots.
    if(profile.headwear===undefined&&profile.accessory==='cap')profile.headwear='cap';
    if(profile.eyewear===undefined&&['glasses','sunglasses','partyglasses'].includes(profile.accessory))profile.eyewear=profile.accessory;
    return profile;
  }
  return Object.freeze({plain,classic,migrate});
})();
window.createCodaBoutiqueUI=function(api){
  'use strict';
  const DEFAULT_CATALOG={
    forms:[['human','Human form'],['alien','Alien transformation'],['starlight','Starlight transformation']],pets:[['none','No companion'],['cosmiccat','Cosmic cat companion'],['neondragon','Neon dragon companion'],['lakeotter','Lake otter companion'],['rhythmfox','Rhythm fox companion'],['pianophoenix','Piano phoenix companion']],
    hairstyles:[['short','Short'],['bob','Bob'],['long','Long'],['curly','Curly'],['ponytail','Ponytail'],['spiky','Spiky'],['bald','No hair'],['buns','Space buns']],
    outfits:[['pants','Shirt and pants'],['shorts','Shirt and shorts'],['dress','Dress'],['overalls','Overalls'],['suit','Suit'],['coat','Long coat']],
    headwear:[['none','No hat'],['cap','Baseball cap'],['beanie','Beanie'],['bucket','Bucket hat'],['crown','Crown'],['headwrap','Headwrap']],
    eyewear:[['none','No glasses'],['glasses','Everyday glasses'],['sunglasses','Sunglasses'],['partyglasses','Party glasses']],
    accessories:[['none','None'],['bow','Bow'],['headphones','Headphones'],['bowtie','Bow tie'],['starclip','Neon star clip'],['halo','Neon halo'],['pixelheadphones','Pixel headphones']],
    shoes:[['sneakers','Sneakers'],['boots','Boots'],['hightops','High tops'],['neon','Neon trainers'],['gold','Gold shoes']],
    emotes:[['wave','Wave'],['dance','Dance'],['spin','Spin'],['robot','Robot'],['disco','Disco point']]
  };
  let targetId='player',current=null;
  const body=api.panelBody;
  const has=(object,key)=>Object.prototype.hasOwnProperty.call(object,key)&&typeof object[key]==='string';
  const catalog=name=>{
    const custom=api.renderer.catalog?.[name];
    const values=Array.isArray(custom)&&custom.length?custom:DEFAULT_CATALOG[name].map(([id,label])=>({id,label}));
    const seen=new Set();
    return values.filter(item=>item&&typeof item.id==='string'&&typeof item.label==='string'&&!seen.has(item.id)&&!!seen.add(item.id));
  };
  const developerMode=()=>api.isDeveloperMode?.()===true;
  function targets(){
    const entries=api.getTargets?.(),available=Array.isArray(entries)&&entries.length?entries:[{id:'player',label:'Your avatar'}];
    const allowed=developerMode()?available:available.filter(item=>item.id==='player');
    return allowed.length?allowed:[{id:'player',label:'Your avatar'}];
  }
  const getProfile=id=>api.getProfile?api.getProfile(id):api.getAvatar();
  const classroomAlias=()=>{try{const value=api.getClassroomAlias?.();return typeof value==='string'&&value.trim()?value.trim().slice(0,80):null;}catch{return null;}};
  function migrateProfile(raw){
    const profile={...(raw||{})},old=profile.accessory;
    // Explicit modern slots always win. Older saves used a single accessory slot.
    if(!has(profile,'headwear')&&old!=='none'&&catalog('headwear').some(item=>item.id===old)){profile.headwear=old;profile.accessory='none';}
    if(!has(profile,'eyewear')&&old!=='none'&&catalog('eyewear').some(item=>item.id===old)){profile.eyewear=old;profile.accessory='none';}
    return api.renderer.normalizeProfile(profile);
  }
  const canEquip=(id,isPlayer)=>id==='human'||id==='none'||!isPlayer&&developerMode()||!api.unlocked||!!api.unlocked(id);
  const lockedReason=id=>{
    const reason=api.lockedReason?.(id);
    return typeof reason==='string'&&reason.trim()?reason.trim():'Locked reward';
  };
  const browseGroups=[
    {key:'headwear',catalog:'headwear',label:'Hats'},
    {key:'eyewear',catalog:'eyewear',label:'Glasses'},
    {key:'accessory',catalog:'accessories',label:'Accessories'},
    {key:'shoes',catalog:'shoes',label:'Shoes'},
    {key:'emote',catalog:'emotes',label:'Emotes'},
    {key:'outfit',catalog:'outfits',label:'Outfits'},
    {key:'hairstyle',catalog:'hairstyles',label:'Hair'},
    {key:'form',catalog:'forms',label:'Transformations'},
    {key:'pet',catalog:'pets',label:'Pets'}
  ];
  function message(text){if(current?.status)current.status.textContent=text;}
  function field(label,key,type,value,choices,isPlayer){
    const wrapper=document.createElement('label');wrapper.className='formRow boutique-field';wrapper.textContent=label;
    const control=document.createElement(type==='select'?'select':'input');control.id='boutique-'+key;control.setAttribute('aria-label',label);
    if(type==='select'){
      for(const item of choices){
        const option=document.createElement('option'),locked=key!=='target'&&!canEquip(item.id,isPlayer);option.value=item.id;
        option.textContent=(locked?'🔒 ':'')+item.label+(locked&&api.lockedReason?' · '+lockedReason(item.id):'');
        option.disabled=locked&&key!=='target';option.setAttribute('aria-disabled',String(option.disabled));option.className=option.disabled?'boutique-option-locked':'';
        if(locked)option.title=item.label+' — '+lockedReason(item.id);control.append(option);
      }
    }else control.type=type;
    control.value=value;wrapper.append(control);body.append(wrapper);return control;
  }
  function color(label,key,value,presets){
    const control=field(label,key,'color',value,null,true);
    const swatches=document.createElement('div');swatches.className='boutique-swatches';swatches.setAttribute('role','group');swatches.setAttribute('aria-label',label+' presets');
    for(const shade of presets){const button=document.createElement('button');button.type='button';button.style.backgroundColor=shade;button.title=shade;button.setAttribute('aria-label',label+' '+shade);button.onclick=()=>{control.value=shade;control.dispatchEvent(new Event('input',{bubbles:true}));};swatches.append(button);}
    control.parentElement.append(swatches);return control;
  }
  function wardrobeBrowser(controls,draft,isPlayer){
    const section=document.createElement('section');section.className='boutique-catalog';section.setAttribute('aria-label','Wardrobe collection');
    const title=document.createElement('h3');title.textContent='Find your next look';
    const intro=document.createElement('p');intro.className='muted';intro.textContent='Choose an unlocked item to try it on. Grey items show what you can earn next.';
    const categories=document.createElement('div');categories.className='boutique-categories';categories.setAttribute('role','group');categories.setAttribute('aria-label','Browse wardrobe categories');
    const searchLabel=document.createElement('label');searchLabel.className='formRow';searchLabel.textContent='Search wardrobe';
    const search=document.createElement('input');search.type='search';search.id='boutiqueSearch';search.setAttribute('aria-label','Search wardrobe');searchLabel.append(search);
    const count=document.createElement('p');count.className='boutique-catalog-count';count.setAttribute('role','status');
    const results=document.createElement('div');results.className='boutique-catalog-results';results.setAttribute('aria-label','Wardrobe items');
    let group=browseGroups[0];const groupButtons=[];
    const previewEmote=()=>{
      const mode=document.getElementById?.('avatarPreviewMode');
      if(mode){mode.value='emote';mode.dispatchEvent(new Event('change',{bubbles:true}));}
    };
    function render(){
      const query=search.value.trim().toLocaleLowerCase(),all=catalog(group.catalog);
      const matches=all.filter(item=>(item.label+' '+item.id).toLocaleLowerCase().includes(query));
      search.placeholder='Search '+group.label.toLowerCase();
      for(const entry of groupButtons)entry.button.setAttribute('aria-pressed',String(entry.group===group));
      count.textContent=matches.length+' of '+all.length+' '+group.label.toLowerCase()+(matches.length?' · unlocked items can be tried on':' · try another search');
      results.replaceChildren();
      for(const item of matches){
        const button=document.createElement('button'),locked=!canEquip(item.id,isPlayer);button.type='button';button.className='boutique-item'+(locked?' is-locked':'');button.disabled=locked;button.setAttribute('aria-disabled',String(locked));
        button.setAttribute('data-item-id',item.id);
        button.setAttribute('aria-label',locked?'Locked: '+item.label+'. '+lockedReason(item.id):'Try '+item.label);button.title=locked?item.label+' — '+lockedReason(item.id):'Try '+item.label;button.setAttribute('aria-pressed',String(controls[group.key].value===item.id));
        if(!locked&&typeof api.renderer.drawPlayer==='function'){
          const canvas=document.createElement('canvas');canvas.width=96;canvas.height=112;canvas.setAttribute('aria-hidden','true');
          const look=draft(),appearance=api.renderer.itemPreviewProfile?.(look,group.key,item.id)||{...look,[group.key]:item.id},ctx=canvas.getContext('2d');
          api.renderer.drawPlayer(ctx,appearance,{x:40,y:98,scale:1.15,facing:'down',walking:false,
            emote:group.key==='emote'?item.id:null,emoteTime:.45,previewPet:true},.45);
          button.append(canvas);
        }
        if(locked){const picture=document.createElement('span');picture.className='boutique-locked-art';picture.textContent='🔒';picture.setAttribute('aria-hidden','true');button.append(picture);}
        const name=document.createElement('span');name.textContent=(locked?'🔒 ':'')+item.label;button.append(name);
        if(locked){
          const locked=document.createElement('small');locked.textContent=lockedReason(item.id);button.append(locked);
        }
        button.onclick=()=>{
          if(!canEquip(item.id,isPlayer)){message('🔒 '+item.label+' — '+lockedReason(item.id));return;}
          controls[group.key].value=item.id;controls[group.key].onchange?.({target:controls[group.key]});
          message('Selected '+item.label+'.');
          results.querySelector?.('[data-item-id="'+item.id+'"]')?.focus?.({preventScroll:true});
        };
        results.append(button);
      }
    }
    for(const candidate of browseGroups){
      const button=document.createElement('button');button.type='button';button.textContent=candidate.label;
      button.setAttribute('aria-label','Browse '+candidate.label);button.onclick=()=>{group=candidate;search.value='';render();};
      categories.append(button);groupButtons.push({group:candidate,button});
    }
    for(const [key,control]of Object.entries(controls)){
      const previous=control.onchange;
      control.onchange=event=>{previous?.(event);if(key==='emote')previewEmote();render();};
    }
    search.oninput=render;
    section.append(title,intro,categories,searchLabel,count,results);render();
    return {section,refresh:render};
  }
  function open(id='player'){
    api.refreshUnlocks?.();
    const available=targets();targetId=available.some(item=>item.id===id)?id:available[0].id;
    const target=available.find(item=>item.id===targetId),isPlayer=targetId==='player';
    const source=getProfile(targetId)||{},profile=migrateProfile(isPlayer?window.CodaAvatarDefaults.migrate(source):source);
    api.openPanel(isPlayer?'Pip · Pixel Boutique':'Boutique · '+target.label);
    body.classList.add('boutique-panel');
    const intro=document.createElement('p');intro.className='muted';intro.textContent=isPlayer?
      (api.openShop?'Mix hats, glasses, accessories, shoes, and moves into your own look. Choose unlocked styles here. Buy shop items with Notes to unlock them. Achievement rewards are marked.':'Mix hats, glasses, accessories, shoes, and moves into your own look. Everyday and fantasy styles are available to guests; achievement rewards are marked.'):
      'Developer styling for '+target.label+'. Their name, musical identity, and behavior stay the same.';body.append(intro);
    if(isPlayer&&typeof api.openShop==='function'){
      const shop=document.createElement('button');shop.type='button';shop.id='boutiqueOpenShop';shop.textContent='♫ Shop with Notes';
      shop.setAttribute('aria-label','Shop accessories with Notes');shop.onclick=()=>api.openShop();body.append(shop);
    }
    const targetControl=field('Customize','target','select',targetId,available.map(item=>({id:item.id,label:item.label})),false);targetControl.disabled=available.length===1;
    targetControl.onchange=()=>open(targetControl.value);
    const alias=isPlayer?classroomAlias():null;
    const name=field(alias?'Classroom alias':'Arcade nickname','name','text',isPlayer?(alias||profile.name):(source.name||target.label),null,isPlayer);name.maxLength=alias?80:18;name.readOnly=!isPlayer||!!alias;
    if(alias){const note=document.createElement('p');note.className='muted boutique-alias-note';note.textContent='Your class alias stays the same when you change your look.';name.parentElement.append(note);}
    const form=field('Transformation','form','select',profile.form||'human',catalog('forms'),isPlayer);
    const pet=field('Companion','pet','select',profile.pet||'none',catalog('pets'),isPlayer);
    const hairstyle=field('Hairstyle','hairstyle','select',profile.hairstyle,catalog('hairstyles'),isPlayer);
    const outfit=field('Outfit','outfit','select',profile.outfit,catalog('outfits'),isPlayer);
    const skin=color('Skin color','skin',profile.skin,['#f4ccb0','#d49a76','#bd825b','#a56b48','#704633','#462c29']);
    const hair=color('Hair color','hair',profile.hair,['#171424','#463145','#713c29','#bb7f43','#e4c183','#ece4d6','#a15ccc','#3d9ba7']);
    const shirt=color('Outfit color','shirt',profile.shirt,['#a7f66f','#69e0ff','#d69cff','#ff9c71','#f472ad','#32486f','#a94655','#e7d6aa']);
    const lowerColor=color('Lower clothing color','lowerColor',profile.lowerColor||'#424258',['#424258','#263347','#5e4a6a','#45688a','#ad793d','#e4ddca','#34313a','#8a4f65']);
    const headwear=field('Hats','headwear','select',profile.headwear||'none',catalog('headwear'),isPlayer);
    const headwearColor=color('Hat color','headwearColor',profile.headwearColor||'#db687f',['#34254c','#3862a0','#b04666','#72b7ad','#e9bf63','#191e2b','#ece4d6','#a46cd1']);
    const eyewear=field('Glasses','eyewear','select',profile.eyewear||'none',catalog('eyewear'),isPlayer);
    const eyewearColor=color('Glasses color','eyewearColor',profile.eyewearColor||'#30374b',['#30374b','#dd6cab','#e9bf63','#65c9df','#ece4d6','#a973cb']);
    const accessory=field('Accessories','accessory','select',profile.accessory||'none',catalog('accessories'),isPlayer);
    const shoes=field('Shoes','shoes','select',profile.shoes,catalog('shoes'),isPlayer);
    const emote=field('Emote','emote','select',profile.emote,catalog('emotes'),isPlayer);
    const rawDraft=()=>{
      const normalized=api.renderer.normalizeProfile({form:form.value,pet:pet.value,name:name.value,hairstyle:hairstyle.value,outfit:outfit.value,skin:skin.value,hair:hair.value,shirt:shirt.value,lowerColor:lowerColor.value,headwear:headwear.value,headwearColor:headwearColor.value,eyewear:eyewear.value,eyewearColor:eyewearColor.value,accessory:accessory.value,shoes:shoes.value,emote:emote.value,hat:false});
      return {...normalized,name:isPlayer?(classroomAlias()||normalized.name):(source.name||target.label),hat:false,
        ...(!isPlayer?{characterId:targetId}:{})};
    };
    const controls={form,pet,hairstyle,hair,skin,outfit,shirt,lowerColor,headwear,headwearColor,eyewear,eyewearColor,accessory,shoes,emote};
    const allowedValues={};
    const fallbackFor=group=>typeof allowedValues[group.key]==='string'&&canEquip(allowedValues[group.key],isPlayer)?allowedValues[group.key]:catalog(group.catalog).find(item=>canEquip(item.id,isPlayer))?.id||window.CodaAvatarDefaults.plain[group.key];
    const itemName=(key,id)=>catalog(browseGroups.find(group=>group.key===key)?.catalog||'accessories').find(item=>item.id===id)?.label||id;
    for(const group of browseGroups){
      const control=controls[group.key];
      const first=catalog(group.catalog).find(item=>canEquip(item.id,isPlayer));
      allowedValues[group.key]=canEquip(control.value,isPlayer)?control.value:first?.id||control.value;
      control.value=allowedValues[group.key];
      control.onchange=()=>{
        if(!canEquip(control.value,isPlayer)){const id=control.value;control.value=allowedValues[group.key]=fallbackFor(group);message('🔒 '+itemName(group.key,id)+' — '+lockedReason(id));return false;}
        allowedValues[group.key]=control.value;message('');return true;
      };
    }
    // The preview getter also checks ownership: a stale or programmatically
    // selected disabled option can never put a locked item on the avatar.
    const draft=()=>{const next=rawDraft();for(const group of browseGroups){const value=next[group.key];if(canEquip(value,isPlayer))allowedValues[group.key]=value;else next[group.key]=allowedValues[group.key]=fallbackFor(group);}return next;};
    const browser=wardrobeBrowser(controls,draft,isPlayer);body.insertBefore(browser.section,hairstyle.parentElement);
    api.getPreviewUI().addPreview(draft);
    const livePreview=body.querySelector?.('.avatar-live-preview');
    if(livePreview){body.insertBefore(targetControl.parentElement,livePreview);livePreview.after(browser.section);browser.section.after(name.parentElement);}
    const note=document.createElement('p');note.className='muted boutique-note';note.textContent=isPlayer?
      'Try unlocked styles. Save applies the complete look; closing leaves your saved look unchanged. '+(api.openShop?'Buy marked shop items with Notes. Other rewards unlock through arcade achievements.':'Locked rewards unlock through arcade achievements.'):
      'Developer NPC costume changes are saved separately from your avatar.';body.append(note);
    const actions=document.createElement('div');actions.className='boutique-actions';
    if(isPlayer){
      for(const [text,id,look]of [['Plain base avatar','boutiqueBaseLook',window.CodaAvatarDefaults.plain],['Classic cap look','boutiqueOriginalLook',window.CodaAvatarDefaults.classic]]){
        const preset=document.createElement('button');preset.type='button';preset.textContent=text;preset.id=id;
        preset.onclick=()=>{for(const [key,value]of Object.entries(look))controls[key].value=value;browser.refresh();message('');};
        actions.append(preset);
      }
    }
    const save=document.createElement('button');save.type='button';save.textContent=isPlayer?'Save my look':'Save NPC look';save.id='boutiqueSave';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.onclick=api.closePanel;
    actions.append(save,cancel);body.append(actions);
    const status=document.createElement('p');status.className='panelMsg';status.setAttribute('role','status');actions.append(status);
    let unlockSignature='';
    function refreshLocks(){
      if(api.refreshUnlocks)api.refreshUnlocks();
      const signature=String(developerMode())+browseGroups.map(group=>catalog(group.catalog).map(item=>canEquip(item.id,isPlayer)?'1':'0').join('')).join('|');
      if(signature===unlockSignature)return;unlockSignature=signature;
      for(const group of browseGroups){const control=controls[group.key];for(const option of control.children){const item=catalog(group.catalog).find(item=>item.id===option.value);if(!item)continue;const locked=!canEquip(item.id,isPlayer);option.disabled=locked;option.className=locked?'boutique-option-locked':'';option.setAttribute('aria-disabled',String(locked));option.textContent=(locked?'🔒 ':'')+item.label+(locked?' · '+lockedReason(item.id):'');option.title=locked?item.label+' — '+lockedReason(item.id):item.label;}}
      browser.refresh();
    }
    current={targetId,source,draft,status,save,refresh:refreshLocks};refreshLocks();
    save.onclick=()=>{
      if(!isPlayer&&!developerMode()){message('Developer mode is required to style NPCs.');return;}
      const next=rawDraft();
      const locked=browseGroups.filter(group=>!canEquip(next[group.key],isPlayer)).map(group=>({id:next[group.key],label:itemName(group.key,next[group.key])}));
      if(locked.length){
        message('Still locked: '+locked.map(item=>item.label+' — '+lockedReason(item.id)).join('; ')+'. Choose unlocked items before saving.');return;
      }
      try{const result=api.applyProfile?api.applyProfile(targetId,next):api.applyAvatar(next);if(result!==false)api.closePanel();else if(!status.textContent)message('The look could not be saved. Your draft is still here.');}
      catch(error){message('The look could not be saved. '+(error?.message||'Please try again.'));}
    };
    return {targetId,draft};
  }
  const refresh=()=>{if(current&&(!body.contains||body.contains(current.save)))current.refresh();};
  for(const type of ['coda-progression-change','storage','focus'])window.addEventListener?.(type,refresh);
  return {open,refresh,getDraft:()=>current?.draft()||null,getTarget:()=>current?.targetId||targetId,migrateProfile};
};
