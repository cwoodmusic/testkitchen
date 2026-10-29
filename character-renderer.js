/* JavaScript-drawn pixel characters restored from the original musician update.
 * No character images or sprite sheets are loaded. Feet stay on gameplay anchors. */
window.createCodaCharacterRenderer=function(api){
  'use strict';
  api=api||{};
  const DIRECTIONS=['down','left','up','right'];
  const HAIR=['short','bob','long','curly','ponytail','spiky','bald','buns','pixie','undercut','braids','locs','afro','slick','pompadour','mohawk','powderwig'];
  const OUTFITS=['pants','shorts','dress','overalls','suit','coat','hoodie','tuxedo','waistcoat','gown','robe','leather','tracksuit','tutu','kimono'];
  const HEADWEAR=['none','cap','beanie','bucket','crown','headwrap','witch','wizard','cowboy','fedora','tophat','beret','pirate','astronaut','flowercrown','tiara','viking','cat','bunny','chef','santa','party','straw','sunvisor','boater','bowler','celestialcrown','triadchampion','pitchlaurel10','pitchlaurel20','pitchlaurel30','pitchcrown40','basslaurel','grandstaffcrown'];
  const EYEWEAR=['none','glasses','sunglasses','partyglasses','round','cateye','aviator','heartglasses','starglasses','steampunk','cybervisor','monocle','3d','shutter','sport','rimless'];
  const ACCESSORIES=['none','bow','headphones','bowtie','starclip','halo','earrings','pixelheadphones','trumpet','microphone','scarf','cape','wings','necklace','pearls','flower','satchel','backpack','guitar','violin','saxophone','wand','fan','watchchain','score','boombox','coffee','teddy','umbrella','shield','sword','lantern','vinyl','camera','book','bouquet','balloon','skateboard','paintpalette','compass','telescope','trophy','handbag','magicorb','gamepad','keytar','flute','accordion','nebulaaura','bassclefpin','grandstaffbadge'];
  const SHOES=['sneakers','boots','hightops','neon','gold','loafers','heels','platforms','rollerskates','iceskates','clown','slippers','barefoot','sandals','ballet','chelsea','oxfords','combat'];
  const EMOTES=['wave','dance','spin','robot','disco','bow','cheer','clap','shrug','heart','peace','airguitar','moonwalk','breakdance','curtsy','salute','facepalm','think'];
  const FORMS=['human','alien','starlight','tv','robot'],PETS=['none','cosmiccat','neondragon','lakeotter','rhythmfox','pianophoenix'];
  const DEFAULTS=Object.freeze({form:'human',pet:'none',name:'Guest',skin:'#e5ad75',hair:'#171424',shirt:'#999ca6',lowerColor:'#626875',hairstyle:'bald',outfit:'pants',headwear:'none',eyewear:'none',accessory:'none',shoes:'sneakers',emote:'wave',headwearColor:'#db687f',eyewearColor:'#30374b'});
  const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
  const choose=(value,values,fallback)=>values.includes(value)?value:fallback;
  const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;
  const reduced=()=>typeof api.reducedMotion==='function'&&!!api.reducedMotion();
  const worldScale=Math.max(.125,Math.min(4,finite(api.worldScale,1)));
  function normalizeProfile(raw){
    const p=raw&&typeof raw==='object'?raw:{};
    return {form:choose(p.form,FORMS,'human'),pet:choose(p.pet,PETS,'none'),name:typeof p.name==='string'?p.name.trim().slice(0,18)||DEFAULTS.name:DEFAULTS.name,
      skin:color(p.skin,DEFAULTS.skin),hair:color(p.hair,DEFAULTS.hair),shirt:color(p.shirt,DEFAULTS.shirt),lowerColor:color(p.lowerColor,DEFAULTS.lowerColor),headwearColor:color(p.headwearColor,DEFAULTS.headwearColor),eyewearColor:color(p.eyewearColor,DEFAULTS.eyewearColor),
      hairstyle:choose(p.hairstyle,HAIR,DEFAULTS.hairstyle),outfit:choose(p.outfit,OUTFITS,DEFAULTS.outfit),
      headwear:own(p,'headwear')?choose(p.headwear,HEADWEAR,'none'):p.accessory==='cap'?'cap':'none',
      eyewear:own(p,'eyewear')?choose(p.eyewear,EYEWEAR,'none'):choose(p.accessory,EYEWEAR,'none'),
      accessory:choose(p.accessory,ACCESSORIES,'none'),shoes:choose(p.shoes,SHOES,DEFAULTS.shoes),emote:choose(p.emote,EMOTES,DEFAULTS.emote)};
  }
  // Identity details stay separate from player equipment. A color swap alone
  // is not enough to identify a visitor at the world's small character scale.
  const historical={
    bach:{name:'J. S. Bach',skin:'#e5b88f',hair:'#dfd9ca',shirt:'#29384e',lowerColor:'#33384c',hairstyle:'powderwig',outfit:'coat',shoes:'oxfords',accessory:'score',hairDetail:'bach-wig',neckwear:'bands',coatStyle:'baroque',bodyScaleX:1.16,bodyScaleY:1.02,headWidth:21,faceDetail:'bach'},
    schoenberg:{name:'Arnold Schoenberg',skin:'#e2b69a',hair:'#68636a',shirt:'#3b414e',lowerColor:'#343541',hairstyle:'bald',outfit:'suit',shoes:'oxfords',neckwear:'tie',bodyScaleX:.91,bodyScaleY:1.08,headWidth:18,faceDetail:'schoenberg'},
    handel:{name:'George Frideric Handel',skin:'#ebbea0',hair:'#e5ddd0',shirt:'#48556c',lowerColor:'#3d4053',hairstyle:'powderwig',outfit:'coat',shoes:'loafers',hairDetail:'handel-wig',neckwear:'lace',coatStyle:'baroque',bodyScaleX:1.24,bodyScaleY:1.04,headWidth:23,faceDetail:'handel'},
    vivaldi:{name:'Antonio Vivaldi',skin:'#e8b695',hair:'#ad5937',shirt:'#38313e',lowerColor:'#322e39',hairstyle:'long',outfit:'coat',shoes:'oxfords',accessory:'violin',hairDetail:'vivaldi-curls',neckwear:'bands',coatStyle:'clerical',bodyScaleX:.88,bodyScaleY:1.09,headWidth:17,faceDetail:'vivaldi'},
    mozart:{name:'Mozart',skin:'#efc2a0',hair:'#eee4cc',shirt:'#bf405d',lowerColor:'#e0d3b8',hairstyle:'powderwig',outfit:'coat',shoes:'loafers',hairDetail:'mozart-queue',neckwear:'lace',coatStyle:'embroidered',bodyScaleX:.94,bodyScaleY:.94,headWidth:18,faceDetail:'mozart'},
    beethoven:{name:'Beethoven',skin:'#d7aa87',hair:'#5d5a62',shirt:'#363847',lowerColor:'#353448',hairstyle:'spiky',outfit:'coat',shoes:'combat',hairDetail:'beethoven-mane',neckwear:'scarf',coatStyle:'storm',bodyScaleX:1.06,bodyScaleY:1.06,headWidth:21,faceDetail:'beethoven'},
    clara:{name:'Clara Schumann',skin:'#edc3a6',hair:'#493331',shirt:'#52678e',lowerColor:'#4d5379',hairstyle:'buns',outfit:'gown',shoes:'ballet',hairDetail:'single-bun',neckwear:'brooch',gownStyle:'victorian',bodyScaleX:.95,bodyScaleY:1.07,headWidth:18,faceDetail:'clara'},
    joplin:{name:'Scott Joplin',skin:'#a36d4f',hair:'#241d27',shirt:'#836d57',lowerColor:'#413449',hairstyle:'slick',outfit:'waistcoat',shoes:'oxfords',accessory:'watchchain',hairDetail:'joplin-part',neckwear:'tie',bodyScaleX:.98,bodyScaleY:1,headWidth:18,faceDetail:'joplin',moustache:'walrus'},
    ellington:{name:'Duke Ellington',skin:'#8e6047',hair:'#231e29',shirt:'#243e61',lowerColor:'#29364c',hairstyle:'pompadour',outfit:'tuxedo',shoes:'loafers',accessory:'bowtie',hairDetail:'duke-wave',neckwear:'collar',bodyScaleX:1.08,bodyScaleY:1.08,headWidth:20,faceDetail:'duke',moustache:'pencil'},
    ella:{name:'Ella Fitzgerald',skin:'#a06c50',hair:'#342333',shirt:'#974e93',lowerColor:'#6b3c72',hairstyle:'curly',outfit:'gown',shoes:'heels',accessory:'microphone',hairDetail:'ella-coiffure',neckwear:'pearls',gownStyle:'satin',earrings:true,bodyScaleX:1.16,bodyScaleY:.98,headWidth:22,faceDetail:'ella'},
    nina:{name:'Nina Simone',skin:'#754a35',hair:'#221c26',shirt:'#bd813b',lowerColor:'#795235',hairstyle:'bald',outfit:'dress',shoes:'sandals',headwear:'headwrap',headwearColor:'#247d87',neckwear:'statement',dressShape:'column',earrings:true,bodyScaleX:.9,bodyScaleY:1.12,headWidth:17,faceDetail:'nina'},
    miles:{name:'Miles Davis',skin:'#885c43',hair:'#211e28',shirt:'#28384e',lowerColor:'#243344',hairstyle:'undercut',outfit:'leather',shoes:'chelsea',eyewear:'sunglasses',accessory:'trumpet',hairDetail:'miles-close',neckwear:'open',bodyScaleX:.88,bodyScaleY:1.04,headWidth:17,faceDetail:'miles'},
    dj:{name:'DJ Coda',skin:'#a56d4b',hair:'#23192e',shirt:'#cf4aa5',lowerColor:'#253c66',hairstyle:'undercut',outfit:'tracksuit',shoes:'neon',eyewear:'cybervisor',accessory:'headphones',bodyScaleX:1.02,bodyScaleY:1.02,headWidth:19,faceDetail:'dj'}
  };
  const appearances=Object.fromEntries(Object.entries(historical).map(([id,p])=>[id,Object.freeze({...normalizeProfile(p),...p,id})]));
  const aliases={'arnold schoenberg':'schoenberg','arnold schönberg':'schoenberg','schönberg':'schoenberg','george frideric handel':'handel','georg friedrich händel':'handel','georg friedrich handel':'handel','händel':'handel','antonio vivaldi':'vivaldi','j. s. bach':'bach','johann sebastian bach':'bach','wolfgang amadeus mozart':'mozart','ludwig van beethoven':'beethoven','clara schumann':'clara','scott joplin':'joplin','duke ellington':'ellington','ella fitzgerald':'ella','nina simone':'nina','miles davis':'miles'};
  const fallback=Object.freeze({...DEFAULTS,id:'guest'});
  function appearanceFor(id){const key=String(id||'').toLowerCase(),known=appearances[aliases[key]||key];if(known)return known;const visitor=window.CodaNPCVisitors?.get?.(key);return visitor?{...normalizeProfile(visitor.appearance),...visitor.appearance,id:visitor.actorId||visitor.id||key,name:visitor.appearance?.name||visitor.name||visitor.label||key}:fallback;}
  const labels={none:'None',short:'Short',bob:'Bob',long:'Long',curly:'Curly',ponytail:'Ponytail',spiky:'Spiky',bald:'No hair',buns:'Space buns',pants:'Shirt and pants',shorts:'Shirt and shorts',dress:'Dress',overalls:'Overalls',suit:'Suit',coat:'Long coat',cap:'Baseball cap',beanie:'Beanie',bucket:'Bucket hat',crown:'Crown',headwrap:'Headwrap',glasses:'Everyday glasses',sunglasses:'Sunglasses',partyglasses:'Party glasses',bow:'Bow',headphones:'Headphones',bowtie:'Bow tie',starclip:'Neon star clip',halo:'Neon halo',earrings:'Earrings',pixelheadphones:'Pixel headphones',trumpet:'Trumpet',microphone:'Microphone',sneakers:'Sneakers',boots:'Boots',hightops:'High tops',neon:'Neon trainers',gold:'Gold shoes',wave:'Wave',dance:'Dance',spin:'Spin',robot:'Robot',disco:'Disco point'};
  Object.assign(labels,{pixie:'Pixie cut',undercut:'Undercut',braids:'Braids',locs:'Locs',afro:'Afro',slick:'Side part',pompadour:'Pompadour',mohawk:'Mohawk',powderwig:'Powdered wig',hoodie:'Oversized hoodie',tuxedo:'Tuxedo',waistcoat:'Waistcoat',gown:'Evening gown',robe:'Fantasy robe',leather:'Leather jacket',tracksuit:'Tracksuit',tutu:'Ballet tutu',kimono:'Wrap robe',witch:'Crooked witch hat',wizard:'Starry wizard hat',cowboy:'Cowboy hat',fedora:'Fedora',tophat:'Top hat',beret:'Beret',pirate:'Pirate tricorn',astronaut:'Space helmet',flowercrown:'Flower crown',tiara:'Tiara',viking:'Horned helmet',cat:'Cat ears',bunny:'Bunny ears',chef:'Chef hat',santa:'Santa hat',party:'Party cone',straw:'Wide straw hat',sunvisor:'Sun visor',boater:'Boater',bowler:'Bowler',round:'Round spectacles',cateye:'Cat-eye frames',aviator:'Aviators',heartglasses:'Heart glasses',starglasses:'Star glasses',steampunk:'Clockwork goggles',cybervisor:'Cyber visor',monocle:'Monocle','3d':'3D glasses',shutter:'Shutter shades',sport:'Sport goggles',rimless:'Rimless glasses',scarf:'Long scarf',cape:'Hero cape',wings:'Angel wings',necklace:'Pendant necklace',pearls:'Pearl necklace',flower:'Buttonhole flower',satchel:'Crossbody satchel',backpack:'Backpack',guitar:'Electric guitar',violin:'Violin',saxophone:'Saxophone',wand:'Magic wand',fan:'Folding fan',watchchain:'Pocket watch chain',score:'Music manuscript',boombox:'Boombox',coffee:'Coffee cup',teddy:'Teddy bear',loafers:'Penny loafers',heels:'Evening heels',platforms:'Platform boots',rollerskates:'Roller skates',iceskates:'Ice skates',clown:'Clown shoes',slippers:'Bunny slippers',barefoot:'Bare feet',sandals:'Strappy sandals',ballet:'Ballet slippers',chelsea:'Chelsea boots',oxfords:'Two-tone Oxfords',combat:'Laced combat boots',cheer:'Big cheer',clap:'Applause',shrug:'Shrug',heart:'Make a heart',peace:'Peace sign',airguitar:'Air guitar',moonwalk:'Moonwalk',breakdance:'Breakdance',curtsy:'Curtsy',salute:'Salute',facepalm:'Facepalm',think:'Thinking'});
  Object.assign(labels,{umbrella:'City umbrella',shield:'Starlight shield',sword:'Toy hero sword',lantern:'Little lantern',vinyl:'Vinyl record',camera:'Instant camera',book:'Spellbook',bouquet:'Flower bouquet',balloon:'Star balloon',skateboard:'Skateboard',paintpalette:'Artist palette',compass:'Explorer compass',telescope:'Pocket telescope',trophy:'Golden trophy',handbag:'Chic handbag',magicorb:'Crystal orb',gamepad:'Game controller',keytar:'Neon keytar',flute:'Silver flute',accordion:'Mini accordion'});
  Object.assign(labels,{human:'Human form',alien:'Alien transformation',starlight:'Starlight transformation',cosmiccat:'Cosmic cat companion',neondragon:'Neon dragon companion',lakeotter:'Lake otter companion',rhythmfox:'Rhythm fox companion',pianophoenix:'Piano phoenix companion',celestialcrown:'Celestial crown',triadchampion:'Triad champion crown',pitchlaurel10:'Bronze pitch laurel',pitchlaurel20:'Silver pitch laurel',pitchlaurel30:'Gold pitch laurel',pitchcrown40:'Radiant pitch crown',nebulaaura:'Nebula aura',bassclefpin:'Bass clef pin',basslaurel:'Bass reader laurel',grandstaffbadge:'Grand staff badge',grandstaffcrown:'Grand staff crown'});
  // The accessory bow and the bow emote share an id; each remains a separate
  // equipment slot, with contextual labels in the catalog.
  const choices=ids=>Object.freeze(ids.map(id=>Object.freeze({id,label:labels[id]})));
  const catalog=Object.freeze({forms:choices(['human','alien','starlight']),visitors:Object.freeze([{id:'visitor-vee-jay',label:'Invite Vee Jay'},{id:'visitor-zizi',label:'Invite Zizi'},{id:'visitor-metronome',label:'Invite Metronome'}].map(Object.freeze)),pets:choices(PETS),hairstyles:choices(HAIR),outfits:choices(OUTFITS),headwear:choices(HEADWEAR),eyewear:choices(EYEWEAR),accessories:choices(ACCESSORIES),shoes:choices(SHOES),emotes:Object.freeze(choices(EMOTES).map(item=>item.id==='bow'?Object.freeze({id:'bow',label:'Take a bow'}):item))});
  function shade(hex,amount){return '#'+[1,3,5].map(offset=>Math.max(0,Math.min(255,parseInt(hex.slice(offset,offset+2),16)+amount)).toString(16).padStart(2,'0')).join('');}
  const palettes=new Map(),cacheLimit=Math.max(16,Math.min(256,Math.round(finite(api.cacheLimit,128))));
  function palette(p){const key=p.skin+p.hair+p.shirt+p.lowerColor;if(palettes.has(key))return palettes.get(key);
    const result={skin:p.skin,skinShade:shade(p.skin,-24),skinLight:shade(p.skin,18),hair:p.hair,hairShade:shade(p.hair,-23),hairLight:shade(p.hair,20),shirt:p.shirt,shirtShade:shade(p.shirt,-25),shirtLight:shade(p.shirt,25),ink:'#211d34',pants:p.lowerColor,pantsShade:shade(p.lowerColor,-22),pantsLight:shade(p.lowerColor,18)};
    if(palettes.size>=cacheLimit)palettes.delete(palettes.keys().next().value);palettes.set(key,result);return result;
  }
  function sampleMotion(raw={},time=0){
    const m=raw&&typeof raw==='object'?raw:{},quiet=reduced(),t=finite(time),phase=finite(m.phase);
    const walking=m.walking===true,emote=typeof m.emote==='string'?m.emote:'';
    // Reduced motion keeps one recognizable pose rather than erasing the emote.
    const actionTime=quiet ? .6 : finite(m.emoteTime,t),beat=Math.sin(actionTime*7);
    let facing=choose(m.facing,DIRECTIONS,'down');
    if(emote==='spin'&&!quiet)facing=DIRECTIONS[((Math.floor(actionTime*7)%4)+4)%4];
    if(m.frontEmote&&EMOTES.includes(emote))facing='down';
    // A small step is movement feedback, even with decorative motion reduced.
    // Keep the head/body quiet while the feet still show that an actor walks.
    const stride=walking?Math.round(Math.sin(phase)*(quiet?1:3)):0;
    let dx=0,lift=0,bob=0,gesture='',clip=walking?'walk':'idle',sit=false,lean=0;
      if(!quiet)bob=walking?Math.round(Math.abs(Math.sin(phase))):Math.round(Math.sin(t*1.9+finite(m.seed))*.55);
      if(!walking){
        if(emote==='dance'){dx=Math.round(beat*2);lift=Math.round(Math.abs(beat)*2);gesture='dance';clip='dance';}
        else if(emote==='wave'||emote==='talk'){gesture='wave';clip=emote==='talk'?'talk':'wave';}
        else if(emote==='robot'){gesture='robot';clip='dance';}
        else if(emote==='disco'){gesture='point';clip='wave';}
        else if(emote==='playing'||emote==='interact'){gesture='playing';clip='interact';}
        else if(emote==='sit'){sit=true;clip='sit';bob=-2;}
        else if(EMOTES.includes(emote)){
          gesture=emote;clip='emote';
          if(emote==='bow'){lean=.32+.18*Math.sin(actionTime*3);bob=3;}
          if(emote==='spin'&&m.frontEmote){lean=Math.sin(actionTime*7)*.18;lift=Math.round(Math.abs(beat)*3);dx=Math.round(Math.sin(actionTime*5)*2);}
          if(emote==='cheer'){lift=Math.round(Math.max(0,beat)*5);}
          if(emote==='clap'){dx=Math.round(Math.sin(actionTime*10));}
          if(emote==='shrug'){bob=-2;}
          if(emote==='airguitar'){lean=Math.sin(actionTime*5)*.1;dx=Math.round(beat*2);}
          if(emote==='moonwalk'){dx=Math.round(Math.sin(actionTime*3)*4);lean=-.13;}
          if(emote==='breakdance'){lean=Math.sin(actionTime*5)*.65;lift=3;dx=Math.round(Math.cos(actionTime*5)*4);}
          if(emote==='curtsy'){bob=3;lean=.12;}
        }
      }
    const jumpHeight=Math.max(0,Math.min(160,finite(m.jumpHeight)));
    return {facing,walking,phase,stride,dx,lift,bob,gesture,clip,sit,lean,actionTime,jumpHeight,blink:!quiet&&((t+finite(m.seed)*.37)%5.3+5.3)%5.3>5.13,quiet};
  }
  function drawHair(r,p,c,side,back){
    if(p.hairstyle==='bald')return;
    if(p.hairDetail==='bach-wig'){
      r(-11,-48,22,8,c.hair);r(-8,-50,16,3,c.hairLight);
      for(const x of [-17,10])for(let j=0;j<4;j++){r(x,-43+j*6,8,6,j%2?c.hair:c.hairLight);r(x+1,-39+j*6,6,2,c.hairShade);}
      if(back){r(-11,-42,22,23,c.hair);r(-5,-20,10,5,c.hairShade);}return;
    }
    if(p.hairDetail==='handel-wig'){
      r(-13,-49,26,8,c.hair);r(-9,-52,18,4,c.hairLight);
      for(const x of [-20,11])for(let j=0;j<5;j++){r(x,-43+j*5,10,6,c.hair);r(x+1,-43+j*5,7,2,c.hairLight);r(x+2,-39+j*5,7,2,c.hairShade);}
      if(back){r(-13,-42,26,24,c.hair);r(-9,-22,18,5,c.hairShade);for(const x of [-10,-3,4])r(x,-39,3,18,c.hairLight);}return;
    }
    if(p.hairDetail==='vivaldi-curls'){
      r(-10,-47,20,6,c.hair);r(-6,-49,14,3,c.hairLight);r(-2,-47,2,7,c.skinShade);
      for(const x of side?[-14]:[-14,9])for(let j=0;j<5;j++){r(x,-42+j*5,6,6,c.hair);r(x+1,-42+j*5,3,2,c.hairLight);r(x+1,-38+j*5,5,2,c.hairShade);}
      if(back){r(-10,-41,21,23,c.hair);r(-7,-37,3,19,c.hairLight);r(4,-37,3,19,c.hairShade);r(-8,-18,17,3,c.hairShade);}return;
    }
    if(p.hairDetail==='mozart-queue'){
      r(-11,-45,22,6,c.hair);r(-7,-48,14,4,c.hairLight);r(-13,-41,6,9,c.hair);r(8,-41,6,9,c.hair);
      r(-12,-33,5,3,c.hairShade);r(9,-33,5,3,c.hairShade);
      if(back||side){const x=side?-15:-4;r(x,-29,8,14,c.hair);r(x-1,-27,10,3,'#943d52');r(x+2,-18,4,6,c.hairLight);}
      if(back)r(-9,-40,18,14,c.hair);return;
    }
    if(p.hairDetail==='beethoven-mane'){
      for(const [x,y,w,h]of [[-15,-45,8,10],[-10,-51,8,12],[-3,-55,8,14],[5,-52,8,12],[11,-46,8,11],[-18,-39,8,12],[12,-37,7,12]])r(x,y,w,h,c.hair);
      r(-11,-49,8,3,c.hairLight);r(2,-51,7,3,c.hairLight);r(-15,-31,4,10,c.hairShade);r(12,-32,4,10,c.hairShade);
      if(back)r(-14,-42,28,21,c.hair);return;
    }
    if(p.hairDetail==='ella-coiffure'){
      r(-12,-47,24,10,c.hair);r(-9,-51,19,6,c.hair);r(-15,-43,6,16,c.hair);r(9,-43,7,16,c.hair);
      for(const [x,y]of [[-14,-46],[-9,-50],[-3,-52],[4,-51],[10,-47]]){r(x,y,6,5,c.hairLight);r(x+2,y+3,4,3,c.hair);}
      if(back)r(-12,-40,25,18,c.hair);return;
    }
    if(p.hairDetail==='headwrap'){
      r(-11,-48,22,10,'#3f7b87');r(-13,-43,26,5,'#67a5a1');r(-6,-52,12,7,'#31556f');r(-3,-51,5,5,'#c3a56a');
      if(back)r(-10,-39,20,5,'#31556f');return;
    }
    const style=p.hairDetail==='single-bun'?'single-bun':p.hairstyle;
    // A mohawk is a crest on a shaved head, not spikes on a full hair cap.
    // The crest runs front-to-back, so its profile is long and its front narrow.
    if(style==='mohawk'){
      if(side){
        r(-10,-47,21,5,c.hairShade);
        for(const [x,y,w,h]of [[-9,-54,5,10],[-5,-58,5,14],[0,-60,5,16],[5,-56,5,12]])r(x,y,w,h,c.hair);
        r(-7,-54,3,3,c.hairLight);r(-2,-59,3,11,c.hairLight);r(6,-54,3,2,c.hairLight);
        r(-9,-40,3,10,c.skinShade);r(-8,-38,1,1,c.hairShade);r(-6,-35,1,1,c.hairShade);
      }else{
        r(-4,-57,8,17,c.hairShade);r(-2,-60,5,21,c.hair);r(-1,-61,3,13,c.hairLight);
        r(-3,-43,7,5,c.hair);if(back){r(-3,-40,7,13,c.hair);r(-1,-37,2,9,c.hairLight);}
      }
      return;
    }
    if(style==='undercut'){
      r(-9,-46,19,7,c.hairShade);r(-7,-49,17,7,c.hair);r(-4,-50,12,2,c.hairLight);
      if(back){r(-9,-38,18,8,c.skinShade);r(-8,-35,2,1,c.hairShade);r(4,-35,2,1,c.hairShade);}
      else if(side){r(-10,-40,10,10,c.skinShade);r(-9,-37,2,1,c.hairShade);r(-3,-44,12,3,c.hair);}
      else{r(-10,-40,3,10,c.skinShade);r(8,-40,3,10,c.skinShade);r(-5,-41,13,3,c.hair);}
      return;
    }
    r(-11,-44,22,7,c.hairShade);r(-9,-47,18,6,c.hair);r(-7,-48,14,2,c.hairLight);
    const cropped=['short','pixie','slick','ponytail','buns','single-bun','pompadour'].includes(style),rearDepth=style==='pixie'?8:cropped?10:15;
    if(back){r(-11,-40,22,rearDepth,c.hair);r(-8,-40+rearDepth,16,2,c.hairShade);}
    else{r(-11,-40,4,cropped?7:12,c.hair);r(side?1:-7,-40,side?10:14,4,c.hair);if(side)r(-11,-37,5,cropped?7:15,c.hairShade);else r(8,-39,3,cropped?6:9,c.hairShade);}
    if(style==='bob'){r(-12,-39,side?6:5,16,c.hair);if(!side)r(7,-39,5,16,c.hair);r(-10,-24,side?5:20,3,c.hairShade);}
    if(style==='long'){r(-12,-39,side?7:5,25,c.hair);if(back)r(-9,-25,18,13,c.hair);else if(!side)r(7,-39,5,25,c.hair);}
    if(style==='ponytail'){
      if(side||back){const x=side?-18:-4;r(x,-38,8,23,c.hairShade);r(x+1,-36,6,15,c.hair);r(x+1,-37,6,3,c.shirtLight);r(x+2,-20,4,5,c.hairLight);}
      else{r(-14,-33,4,17,c.hairShade);r(-14,-33,4,3,c.shirtLight);r(-13,-28,2,9,c.hair);}
    }
    if(style==='curly'){for(const [x,y]of [[-13,-44],[-8,-48],[-2,-49],[5,-47],[9,-42],[-13,-36]]){r(x,y,7,7,c.hair);r(x+1,y,3,2,c.hairLight);}if(back)r(-11,-34,22,10,c.hair);}
    if(style==='spiky'){for(const [x,y]of [[-12,-45],[-8,-50],[-2,-52],[5,-49],[10,-44]])r(x,y,5,10,c.hair);r(-8,-46,16,3,c.hairLight);}
    if(style==='buns'){if(side){r(-17,-49,11,10,c.hair);r(-15,-50,6,2,c.hairLight);}else{r(-16,-49,9,9,c.hair);r(7,-49,9,9,c.hair);r(-14,-50,5,2,c.hairLight);r(9,-50,5,2,c.hairLight);}}
    if(style==='single-bun'){const x=side?-17:back?-5:-14;r(x,-47,side?9:10,10,c.hairShade);r(x+1,-48,side?7:8,8,c.hair);if(back)r(-7,-42,14,10,c.hair);}
    if(style==='pixie'){r(-12,-43,8,8,c.hair);r(-7,-47,14,4,c.hairLight);r(7,-38,4,7,c.skinShade);r(-4,-44,9,4,c.hair);}
    if(style==='braids'||style==='locs'){
      const thick=style==='locs';for(const x of back?[-11,-5,1,7]:[-12,8])for(let y=-43;y<-13;y+=5){r(x,y,thick?5:4,5,c.hair);r(x+1,y+1,2,2,thick?c.hairShade:c.hairLight);}
      if(!thick){r(-12,-14,5,2,c.shirtLight);r(8,-14,5,2,c.shirtLight);}else r(-11,-49,23,5,c.hair);
    }
    if(style==='afro'){r(-13,-50,26,6,c.hair);r(-17,-45,34,9,c.hair);r(-18,-38,8,15,c.hair);r(10,-38,8,15,c.hair);r(-14,-52,7,4,c.hairLight);if(back)r(-15,-36,30,16,c.hair);}
    if(style==='slick'){r(-10,-46,20,7,c.hair);r(-5,-45,15,2,c.hairLight);r(-4,-46,2,7,c.skinShade);r(-2,-42,10,1,c.hairLight);if(side)r(-10,-37,5,7,c.skinShade);}
    if(style==='pompadour'){r(-10,-50,21,9,c.hair);r(-6,-54,17,6,c.hair);r(-4,-54,12,2,c.hairLight);r(7,-48,7,5,c.hairShade);}
    if(style==='powderwig'){for(const x of [-16,11])for(let y=-43;y<-23;y+=5){r(x,y,6,5,c.hairLight);r(x+1,y+3,5,2,c.hairShade);}if(back){r(-4,-24,8,10,c.hair);r(-5,-21,10,3,c.shirtShade);}}
    if(p.hairDetail==='joplin-part'){r(-9,-45,18,5,c.hair);r(-1,-46,2,6,c.skinShade);r(-8,-43,5,1,c.hairLight);r(3,-43,5,1,c.hairLight);}
    if(p.hairDetail==='duke-wave'){r(-8,-53,16,5,c.hair);r(-3,-51,12,2,c.hairLight);r(-7,-43,17,2,c.hairLight);}
    if(p.hairDetail==='miles-close'){r(-9,-46,18,5,c.hair);r(-10,-40,3,9,c.skinShade);r(8,-40,3,9,c.skinShade);}
    if(p.hairDetail==='wig'){
      for(const x of [-14,10]){r(x,-39,5,5,c.hairLight);r(x,-34,5,5,c.hair);r(x,-29,5,4,c.hairShade);}
      if(back){r(-4,-25,8,8,c.hair);r(-5,-22,10,3,'#28283e');}
    }
    if(p.hairDetail==='tousled'){r(-16,-42,7,5,c.hair);r(10,-45,7,6,c.hair);r(-13,-48,6,7,c.hairShade);}
  }
  function pixelStar(r,x,y,n,col){r(x-n,y-3*n,2*n,6*n,col);r(x-3*n,y-n,6*n,2*n,col);r(x-2*n,y-2*n,4*n,4*n,col);}
  function pixelHeart(r,x,y,n,col){r(x-3*n,y-2*n,2*n,2*n,col);r(x+n,y-2*n,2*n,2*n,col);r(x-3*n,y,6*n,2*n,col);r(x-2*n,y+2*n,4*n,n,col);r(x-n,y+3*n,2*n,n,col);}
  function drawHeadwear(r,p,c,side,back){
    const a=p.headwear,col=p.headwearColor,dark=shade(col,-30),light=shade(col,22);
    if(a==='cap'){r(-12,-46,24,9,col);r(-9,-48,18,3,light);if(!back)r(side?3:-7,-44,side?6:13,5,'#f3e7d1');r(side?4:-13,-39,side?14:26,3,dark);if(back){r(-12,-40,24,3,col);r(-4,-43,8,4,dark);r(-2,-42,4,2,'#dce5dc');}}
    else if(a==='beanie'){r(-11,-46,22,8,col);r(-8,-49,16,5,light);r(-12,-40,24,4,dark);for(const xx of [-7,-1,5])r(xx,-46,2,6,light);}
    else if(a==='bucket'){r(-10,-47,20,9,col);r(-8,-48,16,2,light);r(-15,-41,30,4,dark);r(-12,-41,24,2,col);r(-14,-38,3,2,col);r(11,-38,3,2,col);}
    else if(a==='crown'){r(-12,-45,24,6,'#e8bd58');for(const xx of [-12,-2,8])r(xx,-51,4,9,'#f7d978');r(-10,-43,20,2,dark);if(!back){r(-9,-43,3,2,light);r(-1,-44,4,3,col);r(5,-43,3,2,light);}}
    else if(a==='headwrap'){r(-11,-48,22,10,col);r(-13,-43,26,5,light);r(-6,-52,12,7,dark);r(-3,-51,5,5,'#c3a56a');if(back)r(-10,-39,20,5,dark);}
    else if(a==='witch'||a==='wizard'){
      const witch=a==='witch';r(-17,-40,34,4,dark);r(-13,-43,27,4,col);
      for(let j=0;j<10;j++){const width=Math.max(4,22-j*2),xx=-width/2+(witch?Math.max(0,j-4)*1.4:0);r(xx,-44-j*2,width,3,j<5?col:dark);}
      r(-10,-45,20,3,witch?'#d79b4b':'#92b9df');
      if(witch){r(8,-64,7,3,dark);r(12,-62,5,3,dark);r(-3,-45,5,4,'#ecd279');r(-2,-44,3,2,dark);}
      else {pixelStar(r,-3,-55,2,'#f2d682');pixelStar(r,5,-48,1,'#fff0a5');}
    }
    else if(a==='cowboy'){r(-11,-48,22,10,col);r(-7,-51,14,5,light);r(-17,-40,34,4,dark);r(-20,-43,5,5,col);r(15,-43,5,5,col);r(-10,-42,20,3,'#765044');}
    else if(a==='fedora'){
      r(-10,-48,20,10,col);r(-7,-51,14,5,col);r(-4,-51,8,2,dark);r(-9,-48,3,6,light);r(7,-47,3,8,dark);
      r(-17,-40,34,3,dark);r(side?5:-15,-39,side?13:30,2,col);r(-10,-44,20,3,dark);if(!back){r(6,-48,2,7,'#e4c18a');r(8,-49,2,4,'#f8dfac');}
    }
    else if(a==='bowler'){
      r(-11,-47,22,9,col);r(-8,-51,16,6,col);r(-4,-54,8,4,col);r(-6,-51,4,2,light);r(-15,-40,30,4,dark);r(-10,-43,20,3,light);
    }
    else if(a==='tophat'){
      r(-10,-62,20,23,col);r(-7,-62,4,18,light);r(7,-61,3,22,dark);r(-16,-40,32,4,dark);r(-10,-45,20,4,dark);if(!back)r(6,-44,3,2,'#eacf8b');
    }
    else if(a==='boater'){
      r(-11,-48,22,10,'#d8b87d');r(-9,-50,18,3,'#f4dba4');r(-11,-44,22,4,col);r(-18,-40,36,4,'#e2c48b');r(-16,-40,32,1,'#f5dfad');for(const xx of [-14,-7,0,7,14])r(xx,-38,2,1,'#b38b54');
    }
    else if(a==='beret'){r(-13,-47,26,7,col);r(-8,-51,23,6,col);r(0,-53,5,3,dark);r(-11,-41,22,3,dark);r(7,-49,7,2,light);}
    else if(a==='pirate'){r(-16,-47,32,8,dark);r(-20,-43,40,5,col);r(-13,-52,8,7,col);r(7,-52,8,7,col);if(!back){r(-3,-47,6,5,'#f4e6cb');r(-4,-42,8,2,'#e5c78d');r(-2,-46,1,1,dark);r(1,-46,1,1,dark);}else r(-1,-48,2,9,dark);}
    else if(a==='astronaut'){r(-13,-49,26,3,'#e1e8ed');r(-16,-46,5,19,'#cad8e1');r(11,-46,5,19,'#cad8e1');r(-13,-29,26,4,'#e1e8ed');r(-8,-52,16,4,'#f5f4e9');r(-16,-40,3,7,col);r(13,-40,3,7,col);if(back)r(-11,-45,22,16,'#bac9d8');else{r(-10,-44,20,2,'#72d9e6');r(9,-42,2,11,'#7edbe1');}}
    else if(a==='flowercrown'){r(-13,-44,26,3,'#6f9861');for(const [x,y]of [[-12,-46],[-5,-49],[3,-48],[10,-45]]){r(x,y,5,5,col);r(x+1,y+1,3,3,'#efd573');r(x-1,y+2,2,2,light);}}
    else if(a==='tiara'){r(-12,-43,24,2,'#d9d6e8');for(let j=-2;j<=2;j++){const xx=j*4,h=7-Math.abs(j)*2;r(xx-1,-43-h,3,h,'#f2d681');r(xx,-44-h,2,2,j===0?light:col);}}
    else if(a==='viking'){r(-12,-46,24,9,'#a4b4c5');r(-9,-49,18,5,'#c5d2dd');r(-11,-40,22,3,col);r(-2,-50,4,14,dark);for(const sign of [-1,1]){r(sign<0?-19:13,-49,6,7,'#e7d3ad');r(sign<0?-22:19,-54,4,7,'#f1e2c4');}}
    else if(a==='cat'||a==='bunny'){r(-12,-44,24,3,dark);for(const x of [-12,6]){const h=a==='bunny'?19:10;r(x,-44-h,7,h,col);r(x+2,-42-h,3,h-4,light);if(a==='cat')r(x+1,-46-h,4,3,dark);}}
    else if(a==='chef'){r(-12,-47,24,10,'#e9e8e2');r(-16,-53,32,8,'#f5f2e7');r(-12,-58,9,9,'#fff7e9');r(-3,-60,10,10,'#fff7e9');r(6,-57,9,8,'#fff7e9');r(-12,-41,24,3,col);}
    else if(a==='santa'){r(-12,-47,24,8,col);for(let j=0;j<7;j++)r(-10+j,-49-j*2,20-j*2,3,col);r(9,-62,5,12,col);r(10,-54,7,6,'#f4eee4');r(-14,-41,28,5,'#f4eee4');}
    else if(a==='party'){for(let j=0;j<12;j++)r(-12+j,-42-j*2,24-j*2,3,col);for(const [x,y]of [[-5,-47],[2,-53],[-1,-59]])r(x,y,3,3,'#f2d17a');r(-2,-68,5,5,'#9ee8dd');}
    else if(a==='straw'){r(-11,-48,22,9,'#dab46c');r(-8,-50,16,3,'#edcc8a');r(-22,-40,44,4,'#d2a35f');r(-18,-42,36,3,'#f1d194');r(-11,-43,22,3,col);for(const xx of [-15,-8,0,8,15])r(xx,-39,2,2,'#b48c58');}
    else if(a==='sunvisor'){r(-12,-45,24,5,col);if(!back)r(side?3:-15,-40,side?17:30,3,light);else{r(-12,-41,24,2,dark);r(-3,-44,6,3,light);}r(-9,-46,18,2,dark);}

  }
  function drawEyewear(r,p,side,back){
    if(p.eyewear==='none')return;
    const a=p.eyewear,col=p.eyewearColor,light=shade(col,30),dark=shade(col,-35);
    if(back){
      // Lenses stay in front of the face. From behind, show only the arms
      // or a goggle strap, rather than painting front-facing glasses on hair.
      if(['cybervisor','sport','steampunk','shutter'].includes(a)){r(-11,-36,22,3,dark);r(-9,-35,18,1,col);if(a==='cybervisor')r(-3,-36,6,3,light);}
      else if(a==='monocle'){r(10,-32,1,5,col);r(9,-27,1,3,col);}
      else{r(-11,-36,2,4,col);r(9,-36,2,4,col);}
      return;
    }
    const eyes=side?[6]:[-6,5];
    if(a==='glasses'||a==='rimless'){
      const frames=side?[[3,9]]:[[-9,8],[2,8]],edge=a==='rimless'?'#a8bdce':col;
      for(const [x,width]of frames){r(x,-37,width,1,edge);r(x,-31,width,1,edge);r(x,-36,1,5,edge);r(x+width-1,-36,1,5,edge);}
      r(side?-8:-2,-35,side?12:4,1,col);if(a==='rimless'){r(side?6:-7,-36,3,1,'#c5ecf0');r(side?11:-9,-35,1,3,col);}
    }else if(a==='heartglasses'||a==='starglasses'){
      for(const x of eyes){if(a==='heartglasses'){pixelHeart(r,x,-36,1,col);r(x-1,-36,2,2,'#f3a7bc');}else{pixelStar(r,x,-34,1,col);r(x-1,-35,2,2,'#f6df97');}}
      r(side?-8:-2,-35,side?12:4,1,col);
    }else if(a==='monocle'){
      const x=side?4:1;r(x,-38,9,1,col);r(x,-30,9,1,col);r(x-1,-37,1,7,col);r(x+9,-37,1,7,col);r(x+1,-36,3,1,'#c5ecf0');
      for(let j=0;j<5;j++)r(x+8-j%2,-29+j*2,1,2,light);
    }else if(a==='cybervisor'){
      if(side){r(-10,-36,14,3,dark);r(-10,-37,4,5,col);r(3,-38,10,9,col);r(5,-37,7,3,'#4de3d9');r(6,-36,3,1,'#f2ffec');}
      else{r(-11,-38,23,9,col);r(-8,-37,19,3,'#4de3d9');r(-5,-36,3,1,'#f2ffec');r(-12,-35,2,3,light);}
    }else if(a==='round'||a==='steampunk'){
      for(const x of eyes){r(x-4,-38,8,2,col);r(x-5,-36,2,6,col);r(x+3,-36,2,6,col);r(x-3,-30,6,2,col);
        if(a==='steampunk'){r(x-3,-36,6,6,'#947147');r(x-2,-35,3,2,'#6de1d2');r(x-6,-35,2,3,'#e3c385');}}
      r(side?-8:-2,-35,side?12:4,1,col);
    }else if(a==='cateye'){
      for(const x of eyes){r(x-4,-37,9,2,col);r(x-3,-35,7,4,col);r(x+(side?3:-5),-40,3,4,col);r(x-2,-36,4,1,'#98b9cb');}r(side?-8:-2,-35,side?12:5,1,col);
    }else if(a==='3d'){
      if(side){r(-9,-36,13,2,col);r(2,-38,11,9,'#ebe9df');r(4,-36,7,5,'#55d4d7');r(2,-38,11,1,col);}
      else{r(-10,-38,22,9,'#ebe9df');r(-8,-36,7,5,'#e85278');r(3,-36,7,5,'#55d4d7');r(-2,-35,4,2,col);r(-10,-38,22,1,col);}
    }else if(a==='shutter'){
      for(const x of eyes){r(x-4,-38,9,9,col);for(const yy of [-36,-33])r(x-3,yy,7,1,light);}r(side?-8:-2,-35,side?12:4,2,col);
    }else if(a==='sport'){
      if(side){r(-10,-36,15,2,dark);r(3,-38,10,8,col);r(5,-36,7,4,'#b6cf55');r(6,-36,3,1,'#f6ffc1');r(-11,-36,3,3,col);}
      else{r(-11,-38,23,8,col);r(-9,-36,19,4,'#b6cf55');r(-5,-36,3,1,'#f6ffc1');r(-12,-35,3,3,dark);}
    }else if(a==='aviator'){
      for(const x of eyes){r(x-4,-37,9,2,'#d9ba78');r(x-4,-35,8,5,col);r(x-2,-30,4,2,col);r(x-2,-35,4,1,'#8da8b5');}r(side?-8:-3,-37,side?12:6,1,'#e6cd90');
    }else{
      if(side){r(3,-36,9,6,col);r(-8,-35,12,2,col);r(6,-35,3,1,'#8da8b5');}
      else {r(-9,-36,7,6,col);r(2,-36,7,6,col);r(-2,-35,4,2,col);r(-7,-35,3,1,'#8da8b5');r(4,-35,3,1,'#8da8b5');}
      if(a==='partyglasses'){r(side?8:-7,-39,2,9,'#f8dc75');r(side?5:-10,-36,8,2,'#f8dc75');}
    }
  }
  function drawBackGear(r,p,c,side,back){
    if(p.accessory==='cape'){
      if(side){r(-16,-24,11,23,'#a34670');r(-18,-3,14,4,'#703658');r(-14,-22,3,20,'#cb6086');}
      else{r(-13,-24,26,22,'#a34670');r(-15,-3,30,4,'#703658');r(-11,-22,4,21,'#cb6086');r(8,-22,3,21,'#873b65');}
    }
    if(p.accessory==='wings'){
      if(side){for(let j=0;j<4;j++){r(-22+j*3,-33+j*2,7,18-j*2,j%2?'#d1dae4':'#f4eee5');r(-21+j*3,-31+j*2,2,12-j,'#fff8ed');}}
      else for(const sign of [-1,1])for(const [x,y,w,h]of [[11,-29,7,18],[16,-34,7,19],[22,-33,5,14],[26,-29,4,8]]){r(sign<0?-x-w:x,y,w,h,'#d1dae4');r(sign<0?-x-w:x,y+1,w-2,h-3,'#f4eee5');}
    }
    if(p.accessory==='backpack'){r(side?-18:-11,-24,side?10:22,22,'#365d71');r(side?-17:-9,-22,side?8:18,20,'#599b9e');r(side?-18:-9,-14,side?5:18,11,'#487e88');}
  }
  function carriedGearOffset(id,side){
    switch(id){
      case 'score':return side?4:0;
      case 'microphone':return side?-4:-1;
      case 'violin':return side?3:2;
      case 'trumpet':case 'saxophone':case 'boombox':case 'coffee':case 'teddy':case 'gamepad':case 'accordion':return side?-4:0;
      case 'guitar':case 'fan':case 'camera':case 'keytar':return side?-3:0;
      case 'wand':return 3;
      case 'umbrella':return -3;
      case 'shield':return side?-8:-4;
      case 'sword':return side?-6:-3;
      case 'lantern':case 'skateboard':case 'compass':case 'telescope':case 'trophy':case 'magicorb':return side?-7:-3;
      case 'vinyl':case 'handbag':return side?-6:-2;
      case 'book':case 'bouquet':case 'paintpalette':return side?-5:-1;
      case 'balloon':return side?0:-4;
      case 'flute':return side?-5:-2;
      default:return null;
    }
  }
  function drawGear(r,p,c,pose,side,back){
    const a=p.accessory;
    if(a==='bow'){const x=side?-5:3;r(x,-43,5,5,'#ec8abd');r(x+7,-43,5,5,'#ec8abd');r(x+4,-41,4,3,'#b94986');r(x+1,-42,2,1,'#ffd0e4');r(x+8,-42,2,1,'#ffd0e4');r(x+4,-38,2,3,'#d66ca4');}
    if(a==='headphones'||a==='pixelheadphones'){
      if(a==='pixelheadphones'){
        r(-12,-46,24,5,'#3a365d');for(const x of [-10,-4,2,8])r(x,-47,4,3,'#8e75d0');
        r(-15,-41,4,10,'#5a4a83');r(11,-41,4,10,'#5a4a83');
        for(const x of side?[-15]:[-16,9]){r(x,-36,8,11,'#302d51');r(x+1,-35,6,9,'#7964aa');r(x+2,-33,4,5,'#79e5d2');r(x+2,-27,4,1,'#f0c775');}
      }else{
        r(-11,-46,22,2,'#63bbc7');r(-14,-43,3,14,'#4c829e');r(11,-43,3,14,'#4c829e');
        for(const x of side?[-15]:[-15,10]){r(x,-35,5,9,'#4c829e');r(x-1,-33,7,5,'#ad78c7');r(x+1,-32,3,3,'#dfb7eb');}
      }
    }
    if(a==='starclip'){const x=side?3:7;r(x,-43,3,9,'#f8dc75');r(x-3,-40,9,3,'#f8dc75');r(x,-40,2,2,'#fff4b9');}
    if(a==='halo'){r(-12,-53,24,2,'#e8e08b');r(-15,-51,3,3,'#c2efb0');r(12,-51,3,3,'#c2efb0');r(-11,-49,22,1,'#d9f5bb');}
    if(a==='bowtie'&&!back){if(side){r(6,-23,4,5,'#e4b5b5');}else{r(-6,-23,5,4,'#e4b5b5');r(1,-23,5,4,'#e4b5b5');r(-1,-22,2,2,'#a96387');}}
    if(a==='earrings'||p.earrings){r(side?0:-11,-29,2,5,'#efcb71');if(!side)r(10,-29,2,5,'#efcb71');}
    const swing=pose.walking?Math.round(pose.stride*.6):0;
    // Carried objects share the forearm plane. Side views bring the grip in
    // with the narrower torso instead of leaving the prop at its front X.
    const propOffset=carriedGearOffset(a,side),bodyRect=r;
    if(propOffset!==null)r=(x,y,w,h,col)=>bodyRect(x+propOffset,y,w,h,col);
    if(a==='microphone'){
      const x=side?10:12,yy=back?-16:-22-swing;
      r(x,yy,2,14,'#b9c3d1');r(x-2,yy-3,6,5,'#5e677f');r(x-1,yy-3,3,1,'#e0e6ed');r(x-2,yy+8,5,4,c.skin);
    }
    if(a==='trumpet'){
      if(back){r(12,-15+swing,3,16,'#dba94e');r(10,-4+swing,7,5,'#f0ce6e');}
      else {const yy=-19-swing;r(6,yy,14,3,'#dba94e');r(18,yy-3,6,8,'#f0ce6e');r(22,yy-2,3,6,'#a87035');r(10,yy+2,7,4,'#bb873c');r(10,yy-4,2,5,'#f4d57d');r(14,yy-4,2,5,'#f4d57d');r(7,yy+3,4,3,c.skin);}
    }
    if(a==='scarf'){r(-9,-26,18,5,'#ec805d');r(side?-12:6,-23,5,18,'#bd4b5b');r(side?-12:6,-7,5,2,'#f5c77c');}
    if(a==='cape'){
      if(back){r(-12,-24,24,22,'#a34670');r(-10,-22,3,19,'#cb6086');r(-2,-23,3,21,'#873b65');r(7,-21,3,19,'#873b65');pixelStar(r,0,-15,1,'#ebbf6b');}
      r(-8,-26,side?13:16,4,'#bf557f');if(!back){r(side?3:-4,-25,3,5,'#edcd78');if(!side)r(1,-25,3,5,'#edcd78');}
    }
    if(a==='wings'){if(back){r(-9,-26,7,10,'#dfe4ec');r(3,-26,7,10,'#dfe4ec');r(-6,-25,2,7,'#fff8ed');r(6,-25,2,7,'#fff8ed');}else if(side)r(-11,-25,3,10,'#f5eee4');else{r(-12,-24,3,8,'#f5eee4');r(10,-24,3,8,'#f5eee4');}}
    if((a==='necklace'||a==='pearls')&&!back){for(let j=side?0:-3;j<=3;j++)r((side?2:0)+j*2,-24+Math.round((3-Math.abs(j))/2),2,2,a==='pearls'?'#f2e4d8':'#e8be66');if(a==='necklace')r(side?6:-1,-19,3,4,'#6bdbcc');}
    if(a==='flower'&&!back){const x=side?1:0;r(x+6,-22,2,9,'#5eac75');r(x+4,-25,7,6,'#dc70ac');r(x+6,-24,3,3,'#f3d77e');r(x+8,-17,4,2,'#80c586');}
    if(a==='satchel'){for(let j=0;j<(side?5:8);j++)r((side?-4:-8)+j*2,-25+j*2,2,4,'#d6a066');const x=side?4:7;r(x,-13,side?9:12,12,'#8b5a52');r(x+1,-13,side?7:10,4,'#b78360');r(x+3,-8,3,3,'#e2be74');}
    if(a==='backpack'){
      if(back){r(-10,-24,21,22,'#365d71');r(-8,-23,17,20,'#62999d');r(-7,-12,15,8,'#467582');r(-6,-12,13,1,'#a2c8bb');r(-2,-11,3,2,'#edc279');r(-5,-27,10,3,'#365d71');}
      else if(side){r(-17,-23,9,21,'#62999d');r(-18,-15,4,11,'#467582');r(2,-24,3,16,'#e8ab64');r(2,-13,4,2,'#c18a59');}
      else{r(-9,-24,3,17,'#e8ab64');r(7,-24,3,17,'#e8ab64');r(-9,-13,3,2,'#aa784f');r(7,-13,3,2,'#aa784f');}
    }
    if(a==='guitar'){
      const xx=side?7:10;r(xx,-15,12,14,'#dd657c');r(xx-3,-11,7,7,'#ec8c94');r(xx+3,-24,4,22,'#b58558');r(xx+2,-28,6,6,'#d4b37b');if(back){r(xx+2,-13,7,9,'#bf4e70');r(xx+4,-24,1,11,'#e7b97d');}else{r(xx+4,-18,1,15,'#eadcca');r(xx,-9,4,3,'#42344b');r(xx+7,-10,2,2,'#f0cf89');}
    }
    if(a==='violin'){const yy=-19-swing;r(8,yy,10,14,'#ad6e45');r(10,yy-5,5,6,'#ce9259');r(11,yy-13,3,13,'#7c493b');r(10,yy-16,5,4,'#d3ab71');if(back){r(10,yy+2,6,9,'#c28a55');r(12,yy+3,1,7,'#dca56b');}else{r(11,yy+2,3,8,'#f1d3a1');r(9,yy+5,1,3,'#5b3935');r(16,yy+4,1,3,'#5b3935');}r(20,yy-15,2,28,'#ddc7a3');}
    if(a==='saxophone'){r(10,-22,3,19,'#e5b654');r(10,-8,9,6,'#dca74f');r(17,-17,5,13,'#efd275');r(18,-21,7,5,'#e1ac4e');r(19,-20,4,2,'#6e4f36');for(const yy of [-17,-12,-7])r(11,yy,2,1,'#fff0ae');}
    if(a==='wand'){r(15,-29,2,25,'#b68abb');pixelStar(r,16,-33,2,'#f2d781');r(20,-40,2,2,'#9ef3e9');r(10,-42,2,2,'#e0a7e8');}
    if(a==='fan'){for(let j=0;j<6;j++)r(8+j*2,-24+j,3,12-j,'#d37c9c');r(10,-24,2,10,'#f2c896');r(16,-20,2,7,'#f2c896');r(10,-13,3,7,'#ad8b62');}
    if(a==='watchchain'&&!back){for(let j=0;j<6;j++)r(-6+j*2,-13+Math.round(Math.sin(j/5*Math.PI)*3),2,1,'#e3c16f');r(6,-14,3,4,'#edcf83');}
    if(a==='score'){r(-22,-20,15,17,'#604451');if(back){r(-21,-19,13,15,'#856579');r(-21,-19,2,15,'#b3908d');r(-17,-14,6,1,'#d5bd8a');r(-17,-12,4,1,'#d5bd8a');}else{r(-21,-19,13,15,'#e4d9b6');for(const yy of [-16,-12,-8])r(-19,yy,9,1,'#83748a');r(-16,-16,2,6,'#403b53');r(-18,-11,3,2,'#403b53');}r(-9,-7,3,4,c.skin);}
    if(a==='boombox'){r(7,-15,22,15,'#5a5a83');r(10,-19,16,4,'#343451');r(9,-11,6,7,'#242b45');r(21,-11,6,7,'#242b45');r(11,-9,2,3,'#8acbd1');r(23,-9,2,3,'#e0a0cc');r(16,-11,4,2,'#e6ce81');r(16,-6,3,3,'#26364c');}
    if(a==='coffee'){r(12,-16,8,11,'#efe3ce');r(20,-14,3,6,'#e8d4bd');r(13,-17,6,2,'#875b4d');r(14,-23,2,4,'#c2d8df');r(17,-26,1,5,'#c2d8df');r(13,-9,6,2,'#ca799b');}
    if(a==='teddy'){r(10,-18,11,14,'#bc8a66');r(9,-25,13,10,'#d0a27b');r(8,-27,4,5,'#a6795c');r(19,-27,4,5,'#a6795c');r(8,-7,5,6,'#a6795c');r(18,-7,5,6,'#a6795c');r(11,-22,2,2,'#302b40');r(18,-22,2,2,'#302b40');r(14,-18,3,2,'#70494a');}
    // Small carried props stay on the same hand anchor in all facings. The
    // renderer mirrors side poses as a unit, including the prop and its grip.
    const handX=side?11:13,handY=-12-swing;
    if(a==='umbrella'){
      r(17,-58,2,49,'#bda3b6');r(13,-10,6,3,'#d5bbca');r(12,-13,3,4,'#bda3b6');
      for(let tier=0;tier<5;tier++)r(-5-tier*4,-61+tier*3,10+tier*8,4,tier%2?'#d176ac':'#b55591');
      r(-23,-47,48,3,'#6e3d78');for(const xx of [-20,-8,4,16])r(xx,-46,8,3,'#e4a4cd');r(-1,-65,3,5,'#e5c68a');r(16,-13,4,4,c.skin);
    }
    if(a==='shield'){
      const x=handX-3;r(x,-23,18,15,'#e8c36c');r(x+2,-25,14,19,'#dcb165');r(x+4,-23,10,17,'#527eac');r(x+6,-7,6,5,'#e8c36c');r(x+8,-4,2,3,'#dcb165');
      if(back){r(x+4,-23,10,17,'#9b7f66');r(x+7,-21,3,13,'#b68f5b');r(x+5,-15,7,3,'#f0d99e');}else pixelStar(r,x+9,-16,1,'#a5e5df');
    }
    if(a==='sword'){
      r(handX+7,-44,3,27,'#becddd');r(handX+8,-48,2,7,'#e9f2ed');r(handX+5,-39,2,22,'#8297b4');r(handX+2,-18,13,3,'#cfaa66');r(handX+7,-15,3,12,'#7b5576');r(handX+6,-4,5,3,'#ebca7e');r(handX+7,-12,4,4,c.skin);
    }
    if(a==='lantern'){
      const x=handX+1,y=handY-7;r(x+3,y-6,8,2,'#c99c63');r(x+1,y-5,2,6,'#c99c63');r(x+10,y-5,2,6,'#c99c63');r(x,y,14,3,'#72546b');r(x+1,y+3,12,13,'#a37651');r(x+3,y+3,8,12,'#ffd883');r(x+5,y+5,4,8,'#fff0be');r(x+1,y+15,12,3,'#74536b');r(x+6,y+2,2,13,'#ba8d5a');
    }
    if(a==='vinyl'){
      const x=handX-1,y=handY-12;r(x+3,y,12,2,'#25293f');r(x,y+3,18,12,'#25293f');r(x+3,y+16,12,2,'#25293f');r(x+2,y+4,14,10,'#41425d');r(x+5,y+2,8,14,'#34374f');r(x+6,y+6,6,6,'#d77da5');r(x+8,y+8,2,2,'#f5d69a');r(x+2,y+5,2,5,'#8b8ca6');r(x+3,y+12,4,1,'#868299');
    }
    if(a==='camera'){
      const x=side?6:3;r(x,-23,23,15,'#dbc7c6');r(x+1,-24,8,3,'#8b6b82');if(back){r(x+2,-21,15,10,'#343b54');r(x+4,-19,11,6,'#7596aa');r(x+18,-20,3,2,'#c09ab5');r(x+18,-16,3,3,'#685572');r(x+1,-9,21,3,'#93768d');}else{r(x+2,-21,5,4,'#bbddda');r(x+10,-22,11,11,'#343b54');r(x+12,-20,7,7,'#7596aa');r(x+14,-18,3,3,'#d1efeb');r(x+1,-9,21,5,'#93768d');r(x+5,-4,12,7,'#f5e6d1');r(x+7,-3,8,4,'#759f9c');}
    }
    if(a==='book'){
      const x=handX-3;r(x,-25,16,22,'#553f71');r(x+2,-24,13,19,'#8262a0');r(x+1,-25,3,22,'#3f355d');r(x+4,-24,10,2,'#d1ae6a');r(x+4,-5,10,2,'#d1ae6a');pixelStar(r,x+10,-15,1,'#efd58f');r(x+13,-17,4,4,'#d9b473');if(back)r(x+6,-21,1,14,'#ac87be');
    }
    if(a==='bouquet'){
      const x=handX+3;r(x-1,-18,3,14,'#698b65');r(x-6,-18,5,3,'#8ab47f');r(x+2,-20,5,3,'#8ab47f');
      for(const [xx,yy,color] of [[-6,-25,'#c9649b'],[0,-29,'#e697b4'],[6,-24,'#d5aa62'],[-1,-20,'#c5a5d2']]){r(x+xx-3,yy,7,6,color);r(x+xx-1,yy+2,3,2,'#f7dfb0');}
      for(let tier=0;tier<4;tier++)r(x-6+tier,-15+tier*3,13-tier*2,4,'#ddd7cb');r(x-4,-5,8,3,'#c37499');
    }
    if(a==='balloon'){
      const x=side?15:19;r(x,-45,1,33,'#bda3b9');r(x-1,-13,4,4,c.skin);pixelStar(r,x,-56,3,'#d47bb6');pixelStar(r,x-1,-57,2,'#e9a3cc');r(x+2,-60,2,2,'#ffe4df');r(x-2,-46,4,3,'#9d5c9b');
    }
    if(a==='skateboard'){
      const x=handX+1;r(x+3,-29,8,3,'#b6917a');r(x+1,-27,12,29,'#d6b18b');r(x+3,2,8,3,'#b6917a');r(x+3,-25,8,25,'#5a8298');r(x+5,-20,4,12,'#a1d9cb');r(x+4,-21,6,3,'#da94b6');r(x-1,-24,3,5,'#c3c8cb');r(x+12,-24,3,5,'#c3c8cb');r(x-1,-4,3,5,'#c3c8cb');r(x+12,-4,3,5,'#c3c8cb');
    }
    if(a==='paintpalette'){
      const x=handX-2;r(x+3,-22,13,2,'#c6a072');r(x,-20,18,13,'#d6b486');r(x+2,-7,12,3,'#c6a072');r(x+11,-10,6,4,'#6e5b5b');for(const [xx,yy,col] of [[3,-18,'#d7718d'],[9,-19,'#82b6b2'],[13,-16,'#e7c66e'],[4,-11,'#9e83ba']])r(x+xx,yy,3,3,col);r(x+17,-30,2,26,'#96735d');r(x+16,-33,4,7,'#b6d2cb');
    }
    if(a==='compass'){
      const x=handX+1;r(x+2,-20,10,3,'#dfbb75');r(x,-17,14,10,'#dfbb75');r(x+3,-7,8,3,'#b68d59');r(x+2,-16,10,9,'#dce1ca');r(x+6,-18,2,12,'#9a85a2');r(x+2,-13,10,2,'#9a85a2');r(x+6,-17,3,5,'#d16e85');r(x+5,-12,3,4,'#54758d');r(x+5,-23,4,3,'#f0d48f');
    }
    if(a==='telescope'){
      const x=handX-2;r(x,-18,7,8,'#ba915f');r(x+5,-21,10,10,'#dab579');r(x+13,-24,8,14,'#ac8259');r(x+16,-23,6,12,'#d8c38f');r(x+18,-22,3,10,'#426779');r(x+19,-20,2,4,'#97d4d5');r(x+7,-21,2,10,'#f0d5a1');r(x+3,-13,4,5,c.skin);
    }
    if(a==='trophy'){
      const x=handX+1;r(x+2,-27,12,3,'#ebc575');r(x+3,-24,10,10,'#d6a454');r(x+6,-14,4,8,'#d6a454');r(x+2,-6,12,3,'#b28450');r(x,-3,16,4,'#65516a');r(x-2,-24,4,9,'#e8c27b');r(x+13,-24,4,9,'#e8c27b');r(x,-16,5,3,'#e8c27b');r(x+11,-16,5,3,'#e8c27b');r(x+5,-23,3,6,'#f7dda2');r(x+4,-1,7,1,'#e1c484');
    }
    if(a==='handbag'){
      const x=handX-1,y=handY+1;r(x+3,y-7,10,2,'#bb9877');r(x+1,y-5,2,7,'#bb9877');r(x+12,y-5,2,7,'#bb9877');r(x,y,16,13,'#ab6487');r(x+2,y+2,12,10,'#c17a98');r(x+1,y+1,14,4,'#d795ad');r(x+7,y+4,3,4,'#e8c47b');r(x+1,y+11,14,2,'#744d71');
    }
    if(a==='magicorb'){
      const x=handX+4;r(x-5,-25,10,2,'#b3c2df');r(x-7,-23,14,9,'#9298ce');r(x-5,-14,10,3,'#767eb8');r(x-4,-22,9,7,'#b7d8e4');r(x-2,-23,3,3,'#e0f5ea');r(x+2,-18,3,3,'#cf9acb');r(x-7,-11,14,3,'#ba986d');r(x-5,-8,10,3,'#78627f');r(x-9,-5,18,3,'#ac8c64');
    }
    if(a==='gamepad'){
      const x=side?6:0;r(x+2,-19,21,9,'#a99bbd');r(x,-16,7,9,'#8b80a5');r(x+18,-16,7,9,'#8b80a5');if(back){r(x+7,-17,10,6,'#6b6589');r(x+10,-16,4,3,'#8b80a5');r(x+3,-18,3,1,'#d2c0d3');r(x+18,-18,3,1,'#d2c0d3');}else{r(x+4,-17,3,7,'#38384f');r(x+2,-15,7,3,'#38384f');r(x+17,-17,3,3,'#80c5bc');r(x+21,-14,2,3,'#da91b3');r(x+11,-15,4,2,'#d2c0d3');}r(x+8,-10,3,3,'#6b6589');r(x+15,-10,3,3,'#6b6589');
    }
    if(a==='keytar'){
      const x=side?2:-1;r(x,-21,22,12,'#bb6199');r(x+20,-28,5,18,'#d879ad');r(x+22,-31,6,5,'#c98fbc');if(back){r(x+3,-19,15,7,'#8e4b80');r(x+8,-18,5,3,'#c98fbc');r(x+4,-11,2,2,'#e9c87a');}else{r(x+2,-19,17,7,'#eee2d9');for(let i=0;i<7;i++)r(x+3+i*2,-18,1,i%3?3:5,'#38354e');r(x+3,-10,16,2,'#77d6cb');}r(x+21,-25,2,8,'#6c4c7d');
    }
    if(a==='flute'){
      const x=side?6:1;r(x,-23,29,3,'#aec0d3');r(x+2,-24,25,1,'#e6eae3');r(x+28,-24,3,5,'#859bb4');if(!back)for(const xx of [7,11,15,19,23])r(x+xx,-24,2,2,'#65839e');r(x+6,-20,4,4,c.skin);r(x+19,-20,4,4,c.skin);
    }
    if(a==='accordion'){
      const x=side?1:-10;r(x,-23,28,17,'#523e62');r(x+1,-22,7,15,'#b87088');r(x+21,-22,6,15,'#b87088');for(let j=0;j<6;j++)r(x+9+j*2,-22,1,15,j%2?'#d4a4ab':'#b2859e');if(back){r(x+3,-21,3,12,'#8b506e');r(x+22,-21,3,12,'#8b506e');r(x+2,-20,4,2,'#d5a5a2');}else{r(x+2,-21,4,12,'#e6dbd3');for(let j=0;j<4;j++)r(x+2,-19+j*3,2,1,'#453a50');for(const yy of [-20,-16,-12])r(x+23,yy,2,2,'#e8c985');}
    }
    if(propOffset!==null){
      const left=a==='score',x=side?(left?-8:6):(left?-13:10),y=-12+(left?swing:-swing);
      bodyRect(x,y,4,4,c.skin);bodyRect(x+1,y,2,1,c.skinLight);
      if(['sword','wand','umbrella','balloon','violin'].includes(a)){
        const reach=a==='wand'?17:a==='umbrella'?13:a==='balloon'?14:a==='violin'?12:side?11:16;
        bodyRect(x+2,y,Math.max(2,reach-x),3,c.skin);bodyRect(reach,y-1,4,4,c.skinLight);
      }
    }
  }
  function drawShoe(r,x,y,kind,c,side=false,back=false){
    // Every sole ends at y+2, the same floor anchor as the plain sneaker.
    // Front pairs stay narrow; side views alone extend a toe forwards.
    const w=side?9:7,q=(xx,yy,ww,hh,col)=>r(x+xx,y+yy,ww,hh,col);
    const sole=col=>q(0,1,w,1,col),heelTab=col=>q(2,-2,2,3,col);
    if(['sneakers','boots','hightops','neon','gold'].includes(kind)){
      const col={sneakers:'#b7bbc4',boots:'#624c46',hightops:'#bc7e9c',neon:'#77d9c5',gold:'#e7bf5f'}[kind],high=kind==='boots'?6:kind==='hightops'?5:3;
      q(0,-high,6,high+2,c.ink);q(1,-high,4,high+1,col);if(side){q(4,-2,5,3,col);q(5,-2,3,1,shade(col,24));}
      sole(kind==='boots'?'#312c40':'#f1e9df');
      if(back){q(2,-high,2,high,'#6e7484');q(2,-high+1,2,1,shade(col,30));}
      else if(kind==='boots'){q(1,-5,4,1,'#9d8065');q(4,-4,1,3,'#3d343b');}
      else{q(2,-2,3,1,'#f2e4da');if(high>3)q(2,-4,3,1,'#f2e4da');}
      if(kind==='neon'){q(side?5:1,0,side?4:5,1,'#b6fff0');q(1,-3,1,2,'#388e9a');}
      if(kind==='gold'){q(side?5:1,-1,3,1,'#fff0a3');q(1,-3,2,1,'#bf883d');}return;
    }
    if(kind==='barefoot'){
      q(0,-2,side?8:6,4,c.skinShade);q(1,-2,side?6:4,3,c.skin);
      if(back)heelTab(c.skinLight);else for(const xx of side?[5,7]:[1,3,5])q(xx,1,1,1,c.skinLight);return;
    }
    if(kind==='sandals'){
      q(0,-2,w,3,c.skin);sole('#7d634f');
      if(back){q(1,-3,4,1,'#dcbd7b');q(1,-2,1,3,'#dcbd7b');q(4,-2,1,3,'#dcbd7b');}
      else if(side){q(1,-3,1,4,'#dcbd7b');q(5,-1,1,2,'#dcbd7b');q(4,-2,4,1,'#ebd598');}
      else{q(1,-1,1,2,'#dcbd7b');q(5,-1,1,2,'#dcbd7b');q(1,-2,5,1,'#ebd598');}return;
    }
    if(kind==='heels'){
      q(1,-4,4,4,c.skin);q(0,-1,w,2,'#b14a76');
      if(side){q(0,0,2,2,'#6a3357');q(5,1,4,1,'#eab0ba');q(3,0,2,1,c.skinShade);}
      else if(back){q(1,-3,4,2,'#7f3c64');q(2,0,2,2,'#6a3357');}
      else{q(0,1,w,1,'#eab0ba');q(2,-1,3,1,'#e986a5');}return;
    }
    if(kind==='platforms'){
      q(0,-7,6,7,'#7b5d9a');q(0,-1,w,3,'#3b3557');if(side)q(4,-3,5,3,'#7b5d9a');
      if(back){q(2,-6,2,5,'#503f76');q(2,-6,2,1,'#d4a7d5');}else{q(1,-6,4,2,'#d4a7d5');q(2,-2,3,1,'#f1d993');}q(1,0,w-2,1,'#5b4b79');return;
    }
    if(kind==='rollerskates'){
      q(0,-8,6,7,'#d574a4');if(side)q(4,-4,5,3,'#e991b7');q(0,-2,w,2,'#abcbd6');
      if(back){q(2,-7,2,5,'#a24e84');q(1,-1,4,1,'#d9e7e4');}else{q(2,-6,3,1,'#f7dfb9');q(2,-4,3,1,'#f7dfb9');}
      for(const xx of side?[0,6]:[0,4]){q(xx,0,3,2,'#52adac');q(xx+1,0,1,1,'#baffdf');}return;
    }
    if(kind==='iceskates'){
      q(0,-8,6,7,'#eee8d8');if(side)q(4,-4,5,3,'#eee8d8');
      if(back){q(2,-7,2,6,'#b4c8d3');}else{q(2,-6,3,1,'#778798');q(2,-4,3,1,'#778798');}
      q(1,-1,1,2,'#859bad');q(side?6:4,-1,1,2,'#859bad');q(0,1,w,1,'#dde9ee');return;
    }
    if(kind==='clown'){
      const width=side?11:10;q(-1,-3,width,4,'#db6459');q(0,-4,width-2,2,'#ec9b68');q(-1,1,width,1,'#f0c867');
      if(back){q(1,-3,3,3,'#b94856');q(2,-2,1,2,'#f3e4bd');}else{q(side?6:4,-2,3,2,'#f3e4bd');q(side?8:6,-2,2,1,'#ffb080');}return;
    }
    if(kind==='slippers'){
      q(0,-2,w,4,'#c8a1c4');
      if(back){q(1,-3,4,2,'#a47fa5');q(2,-1,2,2,'#f4d9e6');}
      else{const toe=side?5:2;q(toe,-4,4,5,'#e9c3d9');q(toe,-8,1,5,'#e9c3d9');q(toe+3,-7,1,4,'#e9c3d9');q(toe+1,-7,1,3,'#c58aac');q(toe+3,-2,1,1,'#44324a');}return;
    }
    if(kind==='ballet'){
      q(0,-2,w,4,'#e8b2bc');q(1,-1,w-2,1,'#f9d5d4');
      if(back){q(1,-6,1,5,'#dea3b7');q(4,-6,1,5,'#dea3b7');q(1,-4,4,1,'#c68b9e');}
      else{q(2,-6,1,5,'#dea3b7');q(4,-5,1,4,'#dea3b7');q(side?5:2,0,3,1,'#f7dfdb');}return;
    }
    if(kind==='chelsea'||kind==='combat'){
      const combat=kind==='combat';q(0,-7,6,9,combat?'#475247':'#594656');if(side)q(4,-2,5,3,combat?'#475247':'#594656');sole('#2a2839');
      if(back){q(2,-8,2,7,combat?'#788774':'#8e7185');q(2,-8,2,1,'#d6c49b');}
      else if(combat)for(const yy of [-5,-3,-1])q(1,yy,4,1,'#d7cfac');
      else{q(side?1:3,-6,2,5,'#8e7185');q(side?1:3,-5,1,3,'#3b3046');}return;
    }
    if(kind==='oxfords'){
      q(0,-3,w,5,'#443647');sole('#2a2535');
      if(back){q(1,-2,4,2,'#a69a8c');q(2,-3,2,3,'#443647');}
      else{q(side?4:1,-2,side?5:5,3,'#ebe2c7');q(2,-2,2,2,'#443647');q(2,-2,2,1,'#e5be83');}return;
    }
    // Penny loafers have a low vamp and an inset gold bar, not sneaker laces.
    q(0,-2,w,4,'#655044');sole('#302938');q(1,-2,w-2,1,'#aa7b5a');
    if(back){q(1,-1,4,1,'#4b3a38');q(2,-2,2,3,'#8d6651');}else q(side?4:2,-1,side?4:3,1,'#e2ba76');
  }
  const pixelTargets=['player','bach','schoenberg','handel','vivaldi','mozart','beethoven','clara','joplin','ellington','ella','nina','miles','dj','chopin','captain-cadence','haydn','riff','pip','vee-jay','zizi','metronome'];
  let pixelEdits={},pixelTops={},pixelSurface=null;
  const pixelCopy=value=>JSON.parse(JSON.stringify(value));
  function validPixelEdits(data){
    if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(id=>!pixelTargets.includes(id)))return false;
    return Object.values(data).every(views=>views&&typeof views==='object'&&!Array.isArray(views)&&Object.keys(views).every(direction=>DIRECTIONS.includes(direction))&&Object.values(views).every(points=>{
      if(!Array.isArray(points)||points.length>7680)return false;const seen=new Set();
      return points.every(point=>Array.isArray(point)&&point.length===3&&Number.isInteger(point[0])&&point[0]>=0&&point[0]<80&&Number.isInteger(point[1])&&point[1]>=0&&point[1]<96&&(point[2]===null||typeof point[2]==='string'&&/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(point[2]))&&!seen.has(point[1]*80+point[0])&&!!seen.add(point[1]*80+point[0]));
    }));
  }
  function setPixelEdits(data){if(!validPixelEdits(data))return false;pixelEdits=pixelCopy(data);pixelTops={};for(const [target,views]of Object.entries(pixelEdits))for(const points of Object.values(views))for(const [,y,color]of points)if(color!==null&&!(color.length===9&&color.slice(-2).toLowerCase()==='00'))pixelTops[target]=Math.min(pixelTops[target]??96,y);return true;}
  function getPixelEdits(){return pixelCopy(pixelEdits);}
  function canvasFor(ctx,width,height){const doc=ctx?.canvas?.ownerDocument||(typeof document==='object'?document:window.document);const surface=typeof api.createCanvas==='function'?api.createCanvas(width,height):doc?.createElement?.('canvas');if(!surface)return null;surface.width=width;surface.height=height;return surface;}
  function pixelPoints(target,motion,data=pixelEdits){return data[target]?.[DIRECTIONS.includes(motion.facing)?motion.facing:'down']||[];}
  function renderPixelActor(ctx,p,motion,time,points){
    const surface=pixelSurface||(pixelSurface=canvasFor(ctx,128,128));
    if(!surface)return render(ctx,p,motion,time,null);
    const g=surface.getContext('2d');g.clearRect(0,0,128,128);g.imageSmoothingEnabled=false;
    render(g,p,{...motion,x:64,y:104,scale:1,_pixelSurface:true},time,points);
    const pose=sampleMotion(motion,time),scale=motion._pixelFrame?1:Math.max(.25,Math.min(8,finite(motion.scale,1)))*worldScale;
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(finite(motion.x)),Math.round(finite(motion.y)));ctx.scale(scale,scale);
    const shadowScale=1-Math.min(.35,pose.jumpHeight/110);ctx.fillStyle='#080b214f';ctx.beginPath();ctx.ellipse(0,1,13*shadowScale,3*shadowScale,0,0,Math.PI*2);ctx.fill();
    ctx.translate(pose.dx,-pose.lift-pose.jumpHeight);ctx.drawImage(surface,-64,-104);ctx.restore();
  }
  function render(ctx,p,motion,time,points){
    if(points?.length&&!motion._pixelSurface)return renderPixelActor(ctx,p,motion,time,points);
    const pose=sampleMotion(motion,time),c=palette(p),side=pose.facing==='left'||pose.facing==='right',back=pose.facing==='up';
    const x=finite(motion.x),y=finite(motion.y),scale=motion._pixelSurface||motion._pixelFrame?1:Math.max(.25,Math.min(8,finite(motion.scale,1)))*worldScale;
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
    const shadowScale=1-Math.min(.35,pose.jumpHeight/110);
    if(!motion._pixelSurface){ctx.fillStyle='#080b214f';ctx.beginPath();ctx.ellipse(0,1,13*shadowScale,3*shadowScale,0,0,Math.PI*2);ctx.fill();ctx.translate(pose.dx,-pose.lift-pose.jumpHeight);}if(pose.facing==='left')ctx.scale(-1,1);
    const buildX=finite(p.bodyScaleX,1),buildY=finite(p.bodyScaleY,1);
    const r=(x,y,w,h,col)=>{ctx.fillStyle=col;const left=Math.round(x*buildX),top=Math.round(y*buildY);ctx.fillRect(left,top,Math.max(1,Math.round((x+w)*buildX)-left),Math.max(1,Math.round((y+h)*buildY)-top));};
    const stride=['moonwalk','breakdance'].includes(pose.gesture)?Math.round(Math.sin(pose.actionTime*7)*3):pose.stride,dress=p.outfit==='dress'||p.outfit==='gown';
    drawBackGear(r,p,c,side,back);
    for(let leg=0;leg<2;leg++){
      const xx=side?(leg?-1:-6):p.shoes==='clown'?(leg?5:-11):(leg?2:-7),lift=Math.max(0,leg?stride:-stride),bottom=-2-(pose.sit?2:lift);
      const legColor=p.outfit==='shorts'||p.outfit==='tutu'||dress?c.skin:c.pants;
      r(xx,-10,5,Math.max(4,9-lift),c.ink);r(xx+1,-10,3,Math.max(4,8-lift),legColor);drawShoe(r,xx-1,bottom,p.shoes,c,side,back);
    }
    ctx.save();ctx.translate(0,-pose.bob);if(pose.lean)ctx.rotate(pose.lean);
    // Back hair is beneath the torso so long styles do not cover the outfit.
    if(p.hairstyle==='long'&&back){r(-10,-42,20,28,c.hairShade);}
    r(side?-8:-10,-25,side?16:20,18,c.ink);r(side?-7:-9,-24,side?14:18,15,c.shirt);r(side?-6:-8,-23,side?3:4,13,c.shirtLight);r(side?4:6,-23,3,14,c.shirtShade);
    if(p.outfit==='coat'){r(-10,-10,8,7,c.shirtShade);r(2,-10,8,7,c.shirtShade);if(!back){r(-5,-24,3,13,'#c7b795');r(2,-24,3,13,'#c7b795');for(const yy of [-20,-15,-10])r(0,yy,2,2,'#ddc78e');}}
    if(p.outfit==='suit'){
      if(back){r(-10,-24,20,17,c.shirt);r(-9,-24,18,2,c.shirtLight);r(0,-22,1,14,c.shirtShade);r(-5,-9,4,2,c.shirtShade);r(2,-9,4,2,c.shirtShade);}
      else if(side){r(3,-24,5,10,'#e5ddd0');r(6,-22,2,9,'#38394f');r(0,-24,3,11,c.shirtShade);r(1,-11,5,1,c.shirtLight);}
      else{r(-4,-24,8,12,'#e5ddd0');r(-2,-23,4,11,'#38394f');r(-7,-24,3,11,c.shirtShade);r(4,-24,3,11,c.shirtLight);r(-8,-11,5,1,c.shirtShade);r(4,-11,4,1,c.shirtShade);}
    }
    if(p.outfit==='overalls'){r(side?-5:-6,-17,side?10:12,10,c.pants);r(-6,-24,3,14,c.pants);if(!side)r(3,-24,3,14,c.pants);r(-4,-15,8,4,c.pantsShade);r(-4,-20,2,2,'#e9c779');}
    if(p.outfit==='shorts'){r(side?-7:-8,-11,side?14:16,5,c.pants);r(-6,-7,4,3,c.skin);r(2,-7,4,3,c.skin);}
    if(dress){
      const gown=p.outfit==='gown',column=p.dressShape==='column',width=column?18:gown?(p.gownStyle==='victorian'?30:28):24;
      r(-width/2,-16,width,gown?14:12,c.ink);r(-width/2+1,-16,width-2,gown?13:11,c.shirt);r(-width/2,gown?-6:-4,width,2,c.shirtShade);
      r(-width/2+4,-15,3,gown?10:8,c.shirtLight);
      if(gown){for(const xx of [-7,1,7])r(xx,-10,2,6,c.shirtShade);if(p.gownStyle==='satin')for(const [xx,yy]of [[-7,-20],[4,-14],[7,-7],[-2,-5]])pixelStar(r,xx,yy,1,'#d8b5de');}
      if(p.gownStyle==='victorian'){r(-13,-25,26,6,c.shirtShade);r(-9,-25,18,4,'#c9c7d7');}
      if(column){r(-8,-18,16,17,c.shirt);r(6,-10,2,9,'#e3b46b');r(-6,-24,12,4,c.skinShade);}
      if(p.neckwear==='necklace')for(const xx of [-4,-2,0,2])r(xx,-22+Math.abs(xx)/2,2,2,'#ebc67b');
    }
    if(p.outfit==='hoodie'){r(-11,-26,22,7,c.shirtShade);r(-10,-20,20,15,c.shirt);r(-10,-7,20,3,c.shirtShade);if(back){r(-8,-29,16,12,c.shirtLight);r(-6,-27,12,9,c.shirt);r(-5,-18,10,2,c.shirtShade);}else if(side){r(4,-13,4,5,c.shirtShade);r(5,-22,1,9,'#e9d8be');}else{r(-5,-11,10,5,c.shirtShade);r(-3,-22,1,9,'#e9d8be');r(3,-22,1,9,'#e9d8be');}}
    if(p.outfit==='tuxedo'){r(-12,-25,24,8,c.shirtShade);r(-10,-22,20,17,c.shirt);if(!back){r(-5,-25,10,15,'#f1eadb');r(-8,-24,4,12,c.shirtLight);r(4,-24,4,12,c.shirtLight);r(-4,-22,4,3,'#262c43');r(1,-22,4,3,'#262c43');for(const yy of [-15,-10])r(0,yy,2,2,'#a3a6b4');r(7,-20,4,3,'#e1c6d7');}}
    if(p.outfit==='waistcoat'){r(-10,-24,20,17,'#e5d8bf');if(back){r(-8,-24,16,18,c.shirt);r(-7,-13,14,2,c.shirtShade);r(-1,-14,3,4,'#c4b59b');r(0,-22,1,7,c.shirtShade);}else if(side){r(-7,-24,11,18,c.shirt);r(4,-24,4,18,c.shirtShade);r(5,-19,2,2,'#e6bf6c');}else{r(-8,-24,7,18,c.shirt);r(2,-24,7,18,c.shirtShade);for(const yy of [-19,-14,-9])r(0,yy,2,2,'#e6bf6c');r(-6,-11,4,1,c.pantsShade);r(4,-11,4,1,c.pantsShade);}}
    if(p.outfit==='leather'){r(-11,-25,22,18,c.shirtShade);r(-9,-24,18,16,c.shirt);if(!back){r(-3,-24,6,16,'#c9c0b0');r(-7,-25,5,8,c.shirtLight);r(3,-25,5,8,c.shirtLight);r(-2,-19,1,11,'#b4c0c8');r(5,-10,4,1,'#b4c0c8');}r(-11,-14,3,3,'#b4c0c8');}
    if(p.outfit==='tracksuit'){r(-10,-25,20,20,c.shirt);r(-1,-24,2,20,'#ead9c3');r(-9,-25,3,20,'#b0efdf');r(7,-25,3,20,'#b0efdf');r(-10,-7,20,3,c.pantsShade);r(-6,-10,2,8,'#a4dfcf');r(4,-10,2,8,'#a4dfcf');}
    if(p.outfit==='robe'||p.outfit==='kimono'){
      const robe=p.outfit==='robe';r(-12,-25,24,22,c.shirtShade);r(-10,-24,20,20,c.shirt);r(-16,-24,7,15,c.shirt);r(10,-24,7,15,c.shirt);r(-12,-5,25,2,c.shirtShade);
      if(robe){r(-12,-5,25,2,'#ddc48a');if(back){r(-5,-28,10,11,c.shirtShade);pixelStar(r,0,-19,1,'#e3cd89');r(0,-11,1,8,c.shirtLight);}else{for(let j=0;j<6;j++)r(-6+j,-25+j*2,3,4,'#ddc48a');r(-11,-13,23,4,'#c5b26b');pixelStar(r,5,-19,1,'#e3cd89');r(3,-9,3,6,'#d3c38d');}}
      else{r(-12,-14,25,7,'#e4b087');r(-11,-13,23,1,'#f6d6af');if(back){r(-9,-15,8,10,'#cf8f84');r(2,-15,8,10,'#cf8f84');r(-2,-14,5,8,'#f0c39f');r(-7,-12,4,2,'#edb7a1');r(4,-12,4,2,'#edb7a1');}else{for(let j=0;j<6;j++)r(-7+j*2,-25+j*2,3,4,'#f0d3ae');r(side?4:-4,-12,side?5:10,6,'#cf8f84');}}
    }
    if(p.outfit==='tutu'){r(-9,-24,18,15,c.shirt);for(let j=0;j<5;j++)r(-16+j*6,-11+Math.abs(j-2),7,8,j%2?c.shirtLight:c.shirtShade);r(-10,-13,21,3,'#edb7d2');}
    if(p.coatStyle==='baroque'){r(-13,-23,7,22,c.shirtShade);r(7,-23,7,22,c.shirtShade);for(const yy of [-20,-15,-10]){r(-7,yy,2,2,'#d5bd82');r(6,yy,2,2,'#d5bd82');}}
    if(p.coatStyle==='clerical'){r(-10,-25,20,3,c.shirtShade);r(-9,-8,18,9,c.shirtShade);r(-1,-20,2,20,c.shirtLight);if(!back)for(const yy of [-17,-12,-7,-2])r(0,yy,1,2,'#c9c4be');}
    if(p.coatStyle==='embroidered'){r(-10,-21,3,18,'#e4bb70');r(8,-21,3,18,'#e4bb70');for(const yy of [-21,-15,-9])r(5,yy,3,2,'#f3d28d');r(-11,-5,8,3,'#d3a160');r(4,-5,8,3,'#d3a160');}
    if(p.coatStyle==='storm'){r(-13,-24,6,21,c.shirtShade);r(8,-24,6,21,c.shirtShade);r(-9,-25,5,9,c.shirtLight);r(4,-25,6,9,c.shirtLight);}
    // Arms swing from the shoulders; raised gestures stay clear of the face.
    const armSwing=Math.round(stride*.6),leftArm=side?-9:-13,rightArm=side?5:9;
    const raised=['wave','point','robot','dance'].includes(pose.gesture);
    const special=['cheer','clap','shrug','heart','peace','airguitar','curtsy','salute','facepalm','think'].includes(pose.gesture);
    if(!special){
    r(leftArm,-23,4,8,c.shirtShade);r(leftArm,-16+armSwing,4,10,c.skinShade);r(leftArm+1,-15+armSwing,2,7,c.skin);
    r(rightArm,-23,4,8,c.shirt);r(rightArm,-16-armSwing,4,10,c.skin);
    if(raised){
      r(rightArm,-16-armSwing,4,10,c.shirtShade);
      if(pose.gesture==='robot'){
        r(rightArm,-23,11,4,c.skin);r(rightArm+8,-33,4,14,c.skin);r(rightArm+7,-36,6,4,c.skinLight);
        r(leftArm,-16+armSwing,4,10,c.shirt);r(leftArm-8,-22,11,4,c.skinShade);r(leftArm-8,-21,4,13,c.skinShade);r(leftArm-9,-11,6,4,c.skin);
      }else{
        r(rightArm+1,-33,4,16,c.skin);r(rightArm,-37+(Math.round(Math.sin(pose.actionTime*8))),6,5,c.skinLight);
        if(pose.gesture==='point')r(rightArm+3,-40,2,5,c.skinLight);
        if(pose.gesture==='dance'){r(leftArm,-16+armSwing,4,10,c.shirt);r(leftArm-1,-30,4,13,c.skinShade);r(leftArm-2,-33,6,4,c.skin);}
      }
    }
    if(pose.gesture==='playing'){r(leftArm,-16+armSwing,4,10,c.shirtShade);r(rightArm,-16-armSwing,4,10,c.shirtShade);const tap=Math.round(Math.sin(pose.actionTime*10));r(-12,-16+tap,10,4,c.skin);r(3,-16-tap,10,4,c.skinLight);}
    }else{
      const t=pose.actionTime,beat=Math.sin(t*9),hand=(x,y)=>{r(x,y,5,5,c.skin);r(x+1,y,2,2,c.skinLight);};
      r(leftArm,-23,4,7,c.shirtShade);r(rightArm,-23,4,7,c.shirt);
      if(pose.gesture==='cheer'){for(const x of [leftArm,rightArm]){r(x,-36,4,14,c.skin);hand(x-1,-41+Math.round(beat));}}
      if(pose.gesture==='clap'){const gap=Math.round((1+beat)*2);r(leftArm,-20,10,4,c.skinShade);r(3,-20,10,4,c.skin);hand(-5-gap,-23);hand(gap,-23);}
      if(pose.gesture==='shrug'){r(-22,-18,12,4,c.skinShade);r(10,-18,12,4,c.skin);hand(-24,-22);hand(20,-22);r(-23,-24,5,1,c.skinLight);r(20,-24,5,1,c.skinLight);}
      if(pose.gesture==='heart'){r(-12,-21,11,4,c.skinShade);r(2,-21,11,4,c.skin);hand(-5,-23);hand(1,-23);pixelHeart(r,0,-17,1,'#f78fad');}
      if(pose.gesture==='peace'){r(leftArm,-17,4,11,c.skinShade);r(rightArm,-34,4,16,c.skin);hand(rightArm-1,-38);r(rightArm,-44,2,8,c.skinLight);r(rightArm+4,-43,2,7,c.skinLight);}
    if(pose.gesture==='airguitar'){r(-13,-20,15,4,c.skinShade);hand(6,-16+Math.round(beat*2));r(8,-20,4,7,c.skin);}
      if(pose.gesture==='curtsy'){r(-19,-17,10,4,c.skinShade);r(10,-17,10,4,c.skin);hand(-22,-15);hand(18,-15);}
      if(['salute','facepalm','think'].includes(pose.gesture)){r(leftArm,-17,4,11,c.skinShade);r(rightArm,-28,4,13,c.skin);r(4,-29,8,4,c.skin);if(pose.gesture==='salute')r(3,-40,10,4,c.skinLight);}
    }
    r(-5,-29,10,6,c.skinShade);r(-4,-28,8,5,c.skin);
    if(p.neckwear==='cravat'&&!back){r(-4,-26,8,4,'#f2e9d4');r(-2,-22,4,7,'#ddd1bc');r(-4,-21,8,2,'#f5ecdb');}
    if(p.neckwear==='scarf'){r(-6,-26,12,4,'#b9705b');r(3,-23,4,9,'#935649');}
    if(p.neckwear==='collar'&&!back){r(-6,-25,5,3,'#ece5d8');r(1,-25,5,3,'#ece5d8');}
    if(p.neckwear==='tie'&&!back){r(-5,-25,10,3,'#e4dfd5');r(-1,-23,3,8,'#c29a76');}
    if(!back){
      if(p.neckwear==='bands'){r(-7,-26,14,3,'#eee8d8');r(-5,-23,4,10,'#f5edda');r(1,-23,4,10,'#dcd9c8');}
      if(p.neckwear==='lace'){r(-6,-26,12,4,'#f3e8cc');for(let j=0;j<4;j++)r(-4-j%2,-22+j*3,8+j%2*2,2,'#f3e8cc');}
      if(p.neckwear==='brooch'){r(-7,-26,14,4,'#dcd5d2');r(-3,-23,6,5,'#c9c6d7');r(-1,-22,2,3,'#5769a9');}
      if(p.neckwear==='pearls')for(let j=-4;j<=4;j++)r(j*2,-24+Math.round((4-Math.abs(j))*.6),2,2,'#f2e4d8');
      if(p.neckwear==='statement'){r(-8,-24,16,3,'#f1c670');r(-5,-21,10,3,'#c99e4b');r(-2,-18,5,5,'#f3d37f');}
    }
    // A stepped outline retains crisp pixel edges at the same 53px world scale.
    const head=(x,y,w,h,col)=>r(x*finite(p.headWidth,20)/20,y,w*finite(p.headWidth,20)/20,h,col);
    head(-9,-44,18,2,c.ink);head(-11,-42,22,16,c.ink);head(-8,-26,16,3,c.ink);
    head(-9,-42,18,16,c.skin);head(-10,-39,2,10,c.skinShade);head(7,-39,3,12,c.skinShade);head(-7,-42,10,2,c.skinLight);head(-7,-26,14,2,c.skinShade);
    if(!back){
      if(side){head(8,-36,3,5,c.skinLight);head(5,-36,2,pose.blink?1:3,'#2c2736');if(!pose.blink)head(5,-36,1,1,'#f2e9da');head(7,-29,3,1,'#915f56');}
      else {for(const xx of [-6,4]){head(xx,-36,3,pose.blink?1:4,'#2c2736');if(!pose.blink)head(xx,-36,1,1,'#f2e9da');}head(-1,-31,2,2,c.skinShade);head(-3,-28,6,1,'#915f56');}
      if(p.moustache){if(side)head(6,-30,5,2,c.hair);else if(p.moustache==='walrus'){head(-7,-31,14,3,c.hair);head(-5,-28,10,2,c.hairShade);}else{head(-5,-30,10,p.moustache==='pencil'?1:2,c.hair);head(-3,-28,6,1,c.hairShade);}}
      if(!side){
        const brows=p.faceDetail==='beethoven'?[[-7,-39,7,2],[2,-39,7,2]]:p.faceDetail==='bach'?[[-7,-39,6,1],[3,-39,6,1]]:p.faceDetail==='miles'?[[-7,-38,5,1],[3,-38,5,1]]:[];
        for(const box of brows)head(...box,c.hairShade);
        if(p.faceDetail==='schoenberg'){head(-6,-40,12,1,c.skinShade);head(-7,-38,5,1,c.hairShade);head(3,-38,5,1,c.hairShade);head(1,-34,2,4,c.skinShade);head(-4,-28,7,1,'#805b55');}
        if(p.faceDetail==='handel'){head(-8,-39,6,1,c.hairShade);head(3,-39,6,1,c.hairShade);head(-7,-30,3,3,c.skinLight);head(5,-30,3,3,c.skinLight);head(-5,-26,10,1,c.skinShade);}
        if(p.faceDetail==='vivaldi'){head(-6,-39,4,1,c.hairShade);head(3,-39,4,1,c.hairShade);head(0,-34,2,4,c.skinShade);head(-2,-28,4,1,'#956454');}
        if(p.faceDetail==='mozart'){head(6,-30,1,1,c.hairShade);head(-3,-28,6,1,'#ad6c68');}
        if(p.faceDetail==='beethoven'){head(-4,-28,8,1,'#704e4a');head(-7,-30,2,4,c.skinShade);}
        if(p.faceDetail==='clara'){head(-7,-36,1,2,c.hair);head(7,-36,1,2,c.hair);head(-2,-28,4,1,'#a46c76');}
        if(p.faceDetail==='duke'){head(-5,-38,4,1,c.hair);head(4,-38,4,1,c.hair);head(-4,-27,8,1,c.skinLight);}
        if(p.faceDetail==='ella'){head(-8,-30,3,2,c.skinLight);head(6,-30,3,2,c.skinLight);head(-4,-28,8,2,'#a34e63');head(-3,-28,6,1,'#f1c9bc');}
        if(p.faceDetail==='nina'){head(-7,-37,5,1,c.hair);head(3,-37,5,1,c.hair);head(-7,-32,3,2,c.skinShade);head(6,-32,3,2,c.skinShade);head(-3,-28,6,2,'#a35b55');}
      }
    }
    const brim={cap:-37,beanie:-40,bucket:-38,headwrap:-39,witch:-40,wizard:-40,cowboy:-40,fedora:-40,tophat:-40,beret:-41,pirate:-39,astronaut:-27,viking:-40,chef:-41,santa:-41,party:-43,straw:-40,boater:-40,bowler:-40}[p.headwear];
    const hairRect=brim===undefined?r:(x,y,w,h,col)=>{const top=Math.max(y,brim),height=y+h-top;if(height>0)r(x,top,w,height,col);};
    if(p.form==='alien'){
      head(-10,-46,20,19,c.skin);head(-7,-49,14,3,c.skinLight);head(-7,-55,2,8,c.skinShade);head(6,-55,2,8,c.skinShade);head(-9,-57,5,4,'#b3ffe4');head(5,-57,5,4,'#b3ffe4');
      if(!back){if(side){head(4,-40,6,7,'#172b39');head(5,-40,2,2,'#ddfff4');}else{head(-8,-41,6,8,'#172b39');head(3,-41,6,8,'#172b39');head(-7,-40,2,2,'#ddfff4');head(4,-40,2,2,'#ddfff4');}head(-2,-29,5,1,'#31745e');}
    }
    if(p.form==='tv'){
      head(-14,-48,28,23,'#202b46');head(-12,-46,24,19,'#597e92');head(-10,-44,20,15,back?'#344a65':'#8ee6d7');head(-7,-54,2,7,'#c2d8df');head(5,-54,2,7,'#c2d8df');head(-8,-56,4,3,'#f6c66f');head(4,-56,4,3,'#f6c66f');if(!back){head(-6,-39,3,4,'#25314d');head(4,-39,3,4,'#25314d');head(-3,-32,7,1,'#25314d');}
    }
    if(p.form==='robot'){
      head(-12,-46,24,22,'#2d3e58');head(-10,-44,20,18,'#9ab7c8');head(-12,-39,2,9,'#d0e7e8');head(10,-39,3,9,'#526d87');head(-1,-53,2,8,'#d4bd79');head(-3,-56,6,4,'#f7d96d');if(!back){head(-8,-39,6,4,'#71f2da');head(3,-39,6,4,'#71f2da');head(-5,-30,11,3,'#3a536c');head(-3,-30,1,3,'#c9e6e9');head(1,-30,1,3,'#c9e6e9');}
    }
    if(p.form==='starlight'){for(const [sx,sy]of [[-16,-46],[17,-33],[-15,-16],[13,-7]])pixelStar(r,sx,sy,1,'#ffef9c');}
    drawHair(hairRect,p,c,side,back);drawHeadwear(r,p,c,side,back);drawEyewear(r,p,side,back);drawGear(r,p,c,pose,side,back);
    if(p.headwear==='celestialcrown'){
      r(-13,-47,26,3,p.headwearColor);r(-11,-47,22,2,'#f5d681');
      for(const sign of [-1,1]){r(sign<0?-13:10,-52,3,6,'#f5d681');pixelStar(r,sign*11,-55,1,'#ffe9a3');}
      r(-2,-55,4,9,'#b9a2ef');pixelStar(r,0,-60,2,'#f5d681');r(-1,-61,2,2,'#fff9de');
    }
    if(p.headwear==='triadchampion'){
      r(-14,-48,28,4,'#315b6a');r(-13,-47,26,2,'#9cfff0');
      for(const [xx,yy]of [[-12,-56],[-4,-61],[4,-56]]){r(xx,yy,8,10,'#d3ffe9');r(xx+1,yy+1,6,8,'#498394');if(!back){r(xx+4,yy+2,1,5,'#f7e09c');r(xx+2,yy+6,3,2,'#f7e09c');}}
      r(-2,-46,4,3,p.headwearColor);
    }
    if(p.headwear==='pitchcrown40'){
      r(-13,-48,26,5,p.headwearColor);r(-12,-47,24,3,'#ffb5e9');
      for(const [xx,height]of [[-12,7],[-7,11],[-2,16],[3,11],[8,7]]){r(xx,-47-height,4,height,'#ffb5e9');r(xx+1,-47-height,2,3,'#fff2d4');}
      r(-2,-47,4,4,'#96edff');r(-15,-54,2,2,'#fff2d4');r(14,-54,2,2,'#fff2d4');
    }
    if(p.headwear.startsWith('pitchlaurel')){
      const tier={pitchlaurel10:3,pitchlaurel20:4,pitchlaurel30:5}[p.headwear],col={pitchlaurel10:'#c98c58',pitchlaurel20:'#c9e0e7',pitchlaurel30:'#f2d36c'}[p.headwear];
      for(let j=0;j<tier;j++){r(-13+j,-43-j*2,4,3,col);r(10-j,-43-j*2,4,3,col);}
      r(-7,-44-tier*2,14,2,p.headwearColor);if(tier>=4)r(-2,-48-tier*2,4,4,tier===5?'#e891aa':'#8cb5dd');
    }
    if(p.headwear==='basslaurel'){
      for(let j=0;j<4;j++){r(-13+j,-44-j*2,4,3,'#69dbc0');r(10-j,-44-j*2,4,3,'#69dbc0');}r(-8,-53,16,2,p.headwearColor);
      r(-2,-55,4,3,'#ffe398');r(-3,-52,2,4,'#ffe398');r(-5,-49,3,2,'#ffe398');r(4,-55,1,1,'#ffe398');r(4,-52,1,1,'#ffe398');
    }
    if(p.headwear==='grandstaffcrown'){
      r(-13,-49,26,5,p.headwearColor);r(-12,-48,24,3,'#88e6ff');
      for(const xx of [-10,7]){r(xx,-57,4,9,'#b4a1ff');r(xx,-59,4,2,'#fff0a3');}r(-2,-60,4,13,'#fff0a3');
      for(const yy of [-55,-52])r(-8,yy,16,1,'#e5faff');r(-1,-57,2,2,'#ff9de1');
    }
    if(p.accessory==='bassclefpin'||p.accessory==='grandstaffbadge'){
      // Pins follow the body plane; a clasp remains visible from behind.
      const xx=side?5:-5;r(xx,-23,10,10,'#243751');r(xx+1,-22,8,8,p.accessory==='bassclefpin'?'#83dec7':'#c6b0ff');
      if(back){r(xx+2,-19,6,1,'#f4e3a1');}else if(p.accessory==='bassclefpin'){
        r(xx+2,-21,3,2,'#243751');r(xx+4,-19,1,3,'#243751');r(xx+2,-17,2,1,'#243751');r(xx+7,-21,1,1,'#243751');r(xx+7,-18,1,1,'#243751');
      }else{for(const yy of [-21,-19,-17]){r(xx+2,yy,6,1,'#243751');}r(xx+1,-21,1,5,'#f9efa9');r(xx+4,-20,2,1,'#fff6c3');}
    }
    if(p.accessory==='nebulaaura'){for(const [xx,yy]of [[-21,-34],[20,-25],[-19,-8],[17,-47]])pixelStar(r,xx,yy,1,!pose.quiet&&Math.floor(time*3)%2?'#9ae9f8':'#df9df2');}

    if(pose.gesture==='airguitar'){r(-6,-14,15,12,'#d98259');r(-10,-10,8,6,'#e9b36c');for(let j=0;j<5;j++)r(5+j*2,-17-j*2,4,3,'#d7b67b');r(-3,-10,4,4,'#4c3752');}
    if(pose.gesture==='facepalm'){head(1,-38,7,10,c.skin);head(2,-39,4,3,c.skinLight);r(9,-28,4,9,c.skin);}
    if(pose.gesture==='think'){head(3,-29,6,5,c.skinLight);r(11,-57,6,2,'#edce7d');r(15,-55,2,5,'#edce7d');r(12,-50,4,2,'#edce7d');r(12,-46,2,2,'#edce7d');}
    // Details live on the animated body plane. Transparent pixels clear only
    // this isolated character surface, never the world behind its feet.
    if(motion._pixelSurface&&points?.length)for(const [px,py,color]of points){const localX=pose.facing==='left'?39-px:px-40,localY=py-80;if(color===null)ctx.clearRect(localX,localY,1,1);else{if(color.length===9)ctx.clearRect(localX,localY,1,1);ctx.fillStyle=color;ctx.fillRect(localX,localY,1,1);}}
    ctx.restore();ctx.restore();
  }
  function playerLook(profile){
    const base=profile?.characterId?appearanceFor(profile.characterId):null;
    const look=base?{...base,...normalizeProfile({...base,...profile})}:normalizeProfile(profile);
    if(base&&own(profile,'hairstyle')&&profile.hairstyle!==base.hairstyle)delete look.hairDetail;
    if(base&&own(profile,'outfit')&&profile.outfit!==base.outfit)delete look.neckwear;
    if(look.form==='alien'){look.skin='#82d5a0';look.hairstyle='bald';delete look.hairDetail;look.headWidth=21;}
    if(look.form==='starlight'){look.skin='#a9b8f5';look.hair='#e9e7ff';}
    return look;
  }
  // Catalog pictures show the item itself. The live preview keeps the complete
  // draft, including combinations that would hide a haircut or a pair of shoes.
  function itemPreviewProfile(raw,slot,id){
    const p={...normalizeProfile(raw),[slot]:id,pet:'none'};
    if(slot==='pet')return {...p,pet:id,form:'human',hairstyle:'bald',headwear:'none',eyewear:'none',accessory:'none'};
    if(slot==='form')return {...p,hairstyle:'bald',headwear:'none',eyewear:'none',accessory:'none'};
    p.form='human';
    if(slot==='hairstyle')return {...p,headwear:'none',accessory:'none'};
    if(slot==='headwear')return {...p,hairstyle:'bald',accessory:'none'};
    if(slot==='eyewear')return {...p,hairstyle:'bald',headwear:'none',accessory:'none'};
    if(slot==='accessory')return {...p,headwear:'none',eyewear:'none'};
    if(slot==='shoes')return {...p,outfit:'shorts',accessory:'none'};
    if(slot==='outfit'||slot==='emote')return {...p,headwear:'none',accessory:'none'};
    return p;
  }
  function drawPlayer(ctx,profile,motion={},time=0){
    const pose={...(motion&&typeof motion==='object'?motion:{})},target=pose.pixelTarget||profile?.characterId||'player';
    if(EMOTES.includes(pose.emote)){pose.facing='down';pose.frontEmote=true;}
    const look=playerLook(profile);render(ctx,look,pose,time,pixelPoints(target,pose));
    if(pose.previewPet&&look.pet!=='none'&&window.CodaPetCompanion?.drawPet)window.CodaPetCompanion.drawPet(ctx,look.pet,{x:finite(pose.x)+20*finite(pose.scale,1),y:finite(pose.y),scale:finite(pose.scale,1)*.7,facing:pose.facing||'down',moving:pose.walking===true,phase:finite(pose.phase)},time,{reducedMotion:reduced()});
    return true;
  }
  function renderPixelFrame(target,profile={},motion={},time=0,options={}){
    if(!pixelTargets.includes(target))return null;const canvas=canvasFor(null,80,96);if(!canvas)return null;
    const pose={...motion,x:40,y:80,scale:1,_pixelFrame:true},look=playerLook(target==='player'?profile:{...profile,characterId:target}),data=options.pixelEdits&&validPixelEdits(options.pixelEdits)?options.pixelEdits:pixelEdits;
    render(canvas.getContext('2d'),look,pose,time,options.base?null:pixelPoints(target,pose,data));return canvas;
  }
  function drawNPC(ctx,npc,time=0){
    const p=npc&&typeof npc==='object'?npc:{},base=appearanceFor(p.id||p.name),custom=p.appearance&&typeof p.appearance==='object'?p.appearance:{};
    const appearance={...base,...normalizeProfile({...base,...custom}),name:base.name};
    if(own(custom,'hairstyle')&&custom.hairstyle!==base.hairstyle)delete appearance.hairDetail;
    if(own(custom,'outfit')&&custom.outfit!==base.outfit)delete appearance.neckwear;
    if(own(custom,'accessory'))appearance.earrings=custom.accessory==='earrings';
    const activity=p.activity||'',emote=activity==='dancing'?'dance':activity==='chatting'||p.conversation?'talk':activity==='playing'?'playing':activity==='relaxing'?'sit':p.emote;
    const seed=String(base.id).split('').reduce((a,c)=>a+c.charCodeAt(0),0);
    const pose={x:p.x,y:p.y,facing:p.facing,walking:p.walking,phase:p.phase,emote,emoteTime:p.emoteTime,seed};render(ctx,appearance,pose,time,pixelPoints(p.id||base.id,pose));return true;
  }
  function labelOffset(raw={},id){
    const base=id?appearanceFor(id):{},p={...base,...normalizeProfile({...base,...raw})};
    const hats={witch:66,wizard:66,tophat:62,bunny:66,chef:61,party:69,santa:64,viking:58,astronaut:56,cat:57,crown:54,headwrap:55,basslaurel:55,grandstaffcrown:61,celestialcrown:66,triadchampion:62,pitchcrown40:64,pitchlaurel20:57,pitchlaurel30:59};
    const hairTop=p.hairstyle==='mohawk'?60:p.hairstyle==='spiky'||p.hairstyle==='afro'||p.hairstyle==='pompadour'?56:p.hairstyle==='bald'?44:52;
    const gearTop={halo:56,umbrella:65,balloon:66}[p.accessory]||0;
    const top=Math.max(p.form==='alien'||p.form==='tv'||p.form==='robot'?57:0,hairTop,p.headwear==='none'?0:hats[p.headwear]||53,gearTop,p.emote==='think'?59:0);
    const pixelTop=pixelTops[id||raw?.characterId||'player'];return Math.max(59,Math.ceil(top*finite(base.bodyScaleY,1))+9,Number.isFinite(pixelTop)?80-pixelTop+9:0);
  }
  const getState=()=>({ready:true,mode:'javascript-characters',base:'bald-gray',motion:'javascript-animation',artStyle:'procedural-pixel',sourcePolicy:'javascript-drawn',layers:0,tintedFrames:0,paletteCount:palettes.size,cacheLimit,cell:[80,96],totalFrames:0});
  const ready=Promise.resolve({mode:'javascript-characters',base:'bald-gray'});
  return {drawPlayer,drawNPC,setPixelEdits,getPixelEdits,renderPixelFrame,normalizeProfile,itemPreviewProfile,appearanceFor,sampleMotion,labelOffset,catalog,ready,isReady:()=>true,error:null,getState};
};
