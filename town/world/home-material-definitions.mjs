import {furnitureFacingBounds} from './furniture-facing.mjs?v=opera-parallax-1';

// Each private home has its own authored construction, rather than a tint of
// another owner's finish. Texture files are small native-pixel repeat tiles.
const rows=[
 ['bach','Choir Oak','Choir-stave oak parquet','Forest silk and Gothic leaf tracery','Ivory octagon and green cabochon ceramic',['#403126','#b38d55','#231f1d','#a58b54','#395849']],
 ['mozart','Rosewood Ribbon','Ribbon-chevron rosewood','Ivory rose-silk ribbon paper','Rose and ivory ribbon-basket porcelain',['#84554d','#e4c9a2','#47322f','#b7838d','#c9ac71']],
 ['beethoven','Storm Ash','Strapped smoked-ash boards','Rain-slate lime plaster','Honed storm-blue slate pavers',['#39424c','#a49680','#222a34','#a28558','#64717e']],
 ['clara','Birch & Fern','Birch and cane woven parquet','Ivory fern-embossed linen','Jade and ivory glazed fishscale',['#bcaa82','#eee3c8','#827b5f','#78916c','#c7b993']],
 ['chopin','Pearl Nocturne','Mahogany lozenge marquetry','Lavender silk and pearly moon sprigs','Pearl arabesque and lilac mosaic',['#674238','#dfc7ad','#392a30','#b0a0bc','#c4b38b']],
 ['haydn','Sunflower Hearth','Honey-pine pegged running boards','Butter-linen sunflower block print','Hand-fired cream and amber seed tiles',['#a47545','#e6c591','#634b35','#c4a15b','#9b784f']],
 ['handel','Laurel Court','Walnut Greek-key parquet','Olive damask and classical walnut dado','Cream laurel-border marble mosaic',['#70503b','#d7c4a1','#3c3428','#9b8a55','#65734b']],
 ['vivaldi','Four Seasons Cherry','Cherry four-way leaf parquet','Seasonal botanical fresco plaster','Cherry-leaf copper and cream encaustic',['#94624a','#e0bf8a','#513d30','#ab744b','#7d8a55']],
 ['joplin','Maple Rag','Syncopated maple strip parquet','Cream woven paper with stepped indigo fret','Indigo key-border cream penny mosaic',['#a77d50','#ecd5ad','#574539','#52647b','#b2774c']],
 ['ellington','Bluebird Waterfall','Waterfall-walnut fan parquet','Peacock silk feather-ray weave','Blue and ivory wing-fan porcelain',['#76573b','#cdb78a','#34342f','#3e747d','#b39b60']],
 ['ella','Honeysuckle Honey','Honey-oak scallop parquet','Coral honeysuckle woven silk','Petal-pink and ivory small scallop ceramic',['#b18d69','#f0dfbd','#765846','#ce9c91','#a38f67']],
 ['nina','Cedar Sanctuary','Cedar end-grain brick mosaic','Clay-linen plaster and woven sun band','Earth-sage zellige and terracotta border',['#a66c4d','#dec19a','#634b36','#8a9974','#bb9061']],
 ['miles','Midnight Brass','Smoked-walnut brass pinstripe deck','Midnight leather-grain acoustic cloth','Ink-slate and brushed-brass small mosaic',['#4f4035','#ad9475','#282d32','#9c8d60','#526a70']],
 ['dj','Nightjar Studio','Charcoal acoustic-cork bond','Violet acoustic ribbing and equalizer seam','Aubergine micro-porcelain and cyan edge',['#3d394b','#827b94','#242837','#7e5c91','#548c9a']],
 ['vee-jay','Prism Light','Mint and lilac prism terrazzo','Pearlescent video-linen facets','Frosted prism-glass triangular ceramic',['#b2c4ba','#eee4dc','#707b88','#b29fc0','#83b0b0']],
 ['zizi','Orbit Grove','Pale bent-ply crescent parquet','Moss-linen orbital sprigs','Moonstone and sage pebble mosaic',['#c6bda3','#f1e8d1','#8c9179','#b4a1bd','#8fa276']],
 ['metronome','Hickory Tempo','Keyed hickory and copper parquet','Cream tick-stripe paper and hickory dado','Copper-tick ivory hex mosaic',['#9b7149','#e1c69e','#5c4936','#ad8a56','#b69c78']],
 ['schoenberg','Twelve-Tone Ash','Twelve-part ash block composition','Warm ash-linen geometric relief','Muted-primary twelve-piece ceramic',['#a79b80','#e3d8bb','#66635a','#96715b','#788594']],
 ['player','Comet Club','Maple patch parquet and star pegs','Cream cloud-linen and comet trails','Pastel rainbow-link ivory porcelain',['#bc9360','#f3dfb8','#806a4f','#b59fc1','#d7b477']],
 ['showroom-victorian-parlor','Velvet Marquetry','Chestnut octagonal marquetry','Plum silk cameo damask','Ivory cameo-dot octagon marble',['#704633','#c09b6b','#3d2c29','#9b6a79','#bca16a']],
 ['showroom-art-deco-lounge','Starlight Stone','Ebony and ivory octagonal marble','Peacock silk and champagne fan rays','Emerald penny mosaic with champagne border',['#26383b','#dfd0ad','#17282c','#bc9e61','#41757b']],
 ['showroom-coastal-bedroom','Seashell Deck','Bleached-oak rope-jointed deck','Sea-glass linen and shell-sprig paper','Pearl and sea-glass small pebble mosaic',['#b7c5bb','#f0e6d0','#7c9797','#a8c5c2','#cdbd99']],
 ['showroom-rustic-kitchen','Honeybee Clay','Warm clay honeycomb pavement','Cream gingham and tiny bee-wing toile','Honey-cream hex and terracotta rosette',['#b58555','#e8c796','#78593b','#c4a261','#b7a075']],
 ['showroom-botanical-conservatory','Glasshouse Stone','Pale limestone garden flag mosaic','Sage fern-jacquard and rattan dado','Fern-green and limestone leaf mosaic',['#abb3a0','#e4dfc6','#6f8170','#849974','#c3b389']],
 ['showroom-midcentury-studio','Atomic Walnut','Oiled-walnut finger parquet','Cream atomic linen and walnut dado','Ivory olive and teal small hex ceramic',['#93633f','#ebd7b4','#533e2e','#718778','#bf985c']],
 ['showroom-french-cafe','Patisserie Bistro','Cream and charcoal small bistro hex','Blush ticking and painted café lattice','Blush rosette and cream basket porcelain',['#b7aa8d','#f3e6c8','#5d6662','#bd9c91','#b19c75']],
 ['showroom-industrial-loft','Copper Workshop','Reclaimed-oak iron-capped boards','Mineral brick and fine copper service band','Charcoal quarry brick and copper drain trim',['#8d7158','#d0b595','#4b4e4d','#a37755','#708080']],
 ['showroom-retrofuture','Spaceport Terrazzo','Cream orbital-aggregate terrazzo','Warm ivory capsule weave and aqua dado','Aqua ivory and orange capsule ceramic',['#d6ccb1','#f4e9cf','#8b9688','#d38b59','#7ca4a5']],
 ['showroom-cyberpunk','Neon Graphite','Brushed graphite staggered service panels','Midnight acoustic ribs and sparse circuits','Graphite micro-porcelain with cyan corner joints',['#3c4852','#7c8a91','#252e38','#609caa','#a46c91']],
 ['showroom-steampunk','Clockwork Mahogany','Mahogany octagon and brass-key parquet','Sage woven cog-stripe and mahogany dado','Bottle-green ivory and copper gear mosaic',['#79533e','#c8ad79','#45372c','#a8935d','#738167']],
 ['showroom-robot','Companion Cork','Warm cork and powder-blue charging joints','Ivory micro-weave and rounded companion band','Powder-blue ivory and yellow capsule mosaic',['#c0b59a','#f0e3bd','#8a9487','#99b6bb','#d1b46b']]
];
// Architecture recedes behind the furnishings. Each owner keeps an individual
// authored field, with a quieter value/hue and a smaller human-scale grain.
// Pale furniture uses deeper floors; dark wood uses light stone/washed wood.
const contrastRows=[
 ['bach','#c5bead',.68,'#747f77','#d4d5c8','#ebe8dc','#eee5d1',.52,'stone'],
 ['mozart','#c8cbc5',.64,'#958a91','#e2d9cc','#eee5dd','#f2e8dd',.52,'deco'],
 ['beethoven','#bdc5c8',.66,'#6c7a87','#bdc6c7','#d6dfe1','#d9dfe0',.45,'slab'],
 ['clara','#657b7b',.64,'#a6b2a8','#d4dbcf','#e4e8dc','#f0ecd9',.56,'stone'],
 ['chopin','#c8c8ce',.68,'#8e8495','#d9dce0','#e6e2eb','#eee7ed',.54,'deco'],
 ['haydn','#c3c9bc',.64,'#8f9b8a','#d5b99b','#eee1ca','#f0e8d2',.52,'clay'],
 ['handel','#c6c9bd',.66,'#7d8879','#dad6c6','#ece7d4','#e8e8d7',.56,'deco'],
 ['vivaldi','#c7cbbd',.70,'#928d7c','#ccb49b','#eae5d5','#eee7d6',.58,'clay'],
 ['joplin','#c2c9cb',.66,'#788d9b','#d3d8d5','#e2e8e4','#eee8d9',.50,'terrazzo'],
 ['ellington','#c9ccca',.66,'#657f87','#d8d6c6','#e1e9e4','#dee8e4',.48,'deco'],
 ['ella','#6d8389',.66,'#b8b4a7','#d4c4b7','#efe4da','#f0e4d8',.55,'stone'],
 ['nina','#d4c8b0',.70,'#7d8c7c','#c0c8bd','#e5e3d1','#e9e2cd',.55,'clay'],
 ['miles','#bfc7c8',.72,'#6d7c86','#c3cbc9','#dce4e3','#d7dfe1',.48,'slab'],
 ['dj','#a7b2be',.72,'#646a85','#b5bdc8','#d6dce4','#c8c9db',.48,'slab'],
 ['vee-jay','#5e7381',.66,'#aeb0c6','#b4c6c8','#e3e5ee','#ece4ef',.52,'terrazzo'],
 ['zizi','#627d72',.68,'#afa6ba','#c8c9b9','#e6e3d8','#ece5df',.58,'stone'],
 ['metronome','#c0c7c7',.68,'#7e8c8e','#d4c6ac','#e7e0d1','#e9e5d5',.54,'clay'],
 ['schoenberg','#c8cdca',.68,'#7f8c94','#c1c9cd','#e5e6df','#e8e6dd',.54,'terrazzo'],
 ['player','#718994',.64,'#b8abbf','#d6d9d3','#eee6d9','#efe6d6',.52,'terrazzo'],
 ['showroom-victorian-parlor','#cdc3b1',.70,'#7d7883','#d8d5c6','#ece5d6','#ede3d8',.58,'deco'],
 ['showroom-art-deco-lounge','#d5cebb',.65,'#627b7b','#d5d7cd','#e0e9dd','#d9e5dd',.48,'deco'],
 ['showroom-coastal-bedroom','#657f87',.68,'#b4b5a5','#c4cfc9','#e8e6d7','#e8e9da',.56,'stone'],
 ['showroom-rustic-kitchen','#c6c9bb',.68,'#849384','#d5bba0','#eee4ce','#f0e6d2',.58,'clay'],
 ['showroom-botanical-conservatory','#e5decb',.82,'#6c8181','#ced5cd','#e9e7da','#eee8d8',.76,'stone'],
 ['showroom-midcentury-studio','#bdc7ca',.72,'#8799a3','#d6dacf','#e4e8df','#f0e6d2',.54,'terrazzo'],
 ['showroom-french-cafe','#697b81',.64,'#bba6ac','#d9d3c5','#eee4da','#f0e5dd',.58,'deco'],
 ['showroom-industrial-loft','#b9c7c9',.68,'#76868c','#adbcc0','#dce3df','#d6dfdc',.48,'slab'],
 ['showroom-retrofuture','#657f8a',.66,'#c5b3a0','#d8d7c7','#e5e9da','#eee6d2',.58,'terrazzo'],
 ['showroom-cyberpunk','#a4b5bc',.70,'#64748b','#aebbc3','#d5dfe2','#c2ced8',.42,'slab'],
 ['showroom-steampunk','#c5cabc',.70,'#7c8b83','#d0c2a8','#e4e4d5','#e9e4ce',.58,'deco'],
 ['showroom-robot','#667e8c',.66,'#c1b6a0','#cad9d8','#e2e9de','#eee6d3',.56,'terrazzo']
];
const contrastByOwner=new Map(contrastRows.map(([owner,floorColor,floorOpacity,carpet,kitchen,bathWall,wallColor,wallOpacity,kitchenStyle])=>[owner,{floorColor,floorOpacity,carpet,kitchen,bathWall,wallColor,wallOpacity,kitchenStyle}]));
const mix=(hex,other,amount)=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*(1-amount)+parseInt(other.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');
const surfaceColors=base=>[base,mix(base,'#ffffff',.09),mix(base,'#1d2b31',.12),mix(base,'#ffffff',.045),mix(base,'#394348',.055)];
// These two authored wet repeats read as a mirrored chevron/bowtie field.
// Use a quiet real tile layout instead, separate from both walls and dry floors.
const quietWetFloors=new Map([
 ['showroom-botanical-conservatory',{style:'stone',color:'#e2dfd2',label:'Warm ivory square limestone bathroom tile'}],
 ['showroom-midcentury-studio',{style:'porcelain',color:'#c8d0cf',label:'Cool pearl square porcelain bathroom tile'}]
]);
const freeze=value=>{if(value&&typeof value==='object'){for(const part of Object.values(value))freeze(part);Object.freeze(value);}return value;};
const finish=(owner,kind,name,colors,extra={})=>({id:`${owner}-${kind}`,name,label:name,pattern:`home-${owner}-${kind}`,homeMaterial:true,owner,kind,colors,texture:`${owner}-${kind==='wet-wall'?'wet-floor':kind}.webp`,...extra});
export const HOME_MATERIAL_SUITES=freeze(rows.map(([owner,name,floorName,wallName,wetName,colors])=>{
 const contrast=contrastByOwner.get(owner),quietWet=quietWetFloors.get(owner),floor=finish(owner,'floor',floorName,colors,{presentation:{scale:.5,color:contrast.floorColor,opacity:contrast.floorOpacity}}),wallpaper=finish(owner,'wall',wallName,colors,{trimTexture:`${owner}-dado.webp`,presentation:{scale:.65,color:contrast.wallColor,opacity:contrast.wallOpacity},trimPresentation:{scaleX:.65,scaleY:1,color:contrast.wallColor,opacity:.12,...(owner==='showroom-victorian-parlor'?{style:'complete-scroll',fitHeight:true,insetTop:4,insetBottom:4}:{})}});
 return {
  owner,id:`home-suite-${owner}`,name,floor,wallpaper,
  ...(owner==='showroom-victorian-parlor'?{decorativeRugTexture:'victorian-bath-rug.png'}:{}),
  bedroomFloor:finish(owner,'carpet',name+' quiet woven carpet',surfaceColors(contrast.carpet),{texture:null,surfaceStyle:'carpet',presentation:{scale:.5}}),
  kitchenFloor:finish(owner,'kitchen-floor',name+' '+contrast.kitchenStyle+' kitchen floor',surfaceColors(contrast.kitchen),{texture:null,surfaceStyle:contrast.kitchenStyle,presentation:{scale:.5}}),
  wetFloor:quietWet?finish(owner,'wet-floor',quietWet.label,surfaceColors(quietWet.color),{texture:null,surfaceStyle:quietWet.style,presentation:{scale:.5}}):finish(owner,'wet-floor',wetName,colors,{presentation:{scale:.5,color:contrast.bathWall,opacity:.58}}),
  wetWallpaper:finish(owner,'wet-wall',name+' glazed ceramic wall',surfaceColors(contrast.bathWall),{texture:null,surfaceStyle:'ceramic-wall',glazed:true,presentation:{scale:.5}}),
  trim:{wood:colors[0],light:colors[1],shadow:colors[2],metal:colors[3]},
  construction:{floor:floorName,wall:wallName,wet:wetName},
  assets:[`${owner}-floor.webp`,`${owner}-wall.webp`,`${owner}-wet-floor.webp`,`${owner}-dado.webp`]
 };
}));
const byOwner=new Map(HOME_MATERIAL_SUITES.map(suite=>[suite.owner,suite]));
export const getHomeMaterialSuite=owner=>byOwner.get(owner)||null;

/** Surface metadata only: every rectangle, collider, item and route is retained. */
export function applyHomeMaterialSuite(scene,owner){
 const suite=getHomeMaterialSuite(owner);if(!suite)return scene;
 scene.homeMaterialSuite=suite;scene.collectionOwner??=owner;
 scene.color=suite.wallpaper.colors[0];scene.trim=suite.trim.light;
 for(const room of scene.rooms){
  const wet=room.functionalRole==='bathroom'||/bathroom/i.test(room.name);
  const role=room.functionalRole||'';
  room.floorFinish=wet?suite.wetFloor:role==='bedroom'?suite.bedroomFloor:role==='kitchen'?suite.kitchenFloor:suite.floor;room.wallpaper=wet?suite.wetWallpaper:suite.wallpaper;
  // Dining labels describe an open-plan furniture group, not another solid
  // rectangle of flooring across the kitchen/living boundary.
  room.floorOverlay=role!=='dining';
  // Existing north-wall bands are render-only architectural metadata.
  // Never borrow walkable floor to invent a new wall face.
  room.wallpaperAreas??=room.y<=112?[{x:room.x,y:0,w:room.w,h:106}]:[];
 }
 for(const wall of scene.walls){wall.color=suite.trim.wood;wall.trim=suite.trim.light;}
 for(const door of scene.privacyDoors||[]){door.color=suite.trim.wood;door.trim=suite.trim.light;}
 return scene;
}

/** Finish the compact showroom kitchen at its fixture row, without moving rooms. */
export function fitCompactKitchenFloor(scene,catalog){
 if(scene.kind!=='showroom'||scene.width!==1184||scene.height!==448)return scene;
 const kitchen=scene.rooms.find(room=>room.functionalRole==='kitchen'),living=scene.rooms.find(room=>room.functionalRole==='living');
 if(!kitchen||!living)return scene;
 const roles=new Set(['sink','counter','stove','fridge','pantry']),bounds=scene.items.filter(item=>roles.has(item.fixtureRole)).map(item=>{
  const asset=catalog?.get(item.asset);return asset?furnitureFacingBounds(asset,item):{x:item.x-item.w/2,y:item.y-item.h,w:item.w,h:item.h};
 });
 if(!bounds.length)return scene;
 const left=kitchen.x<scene.width/2,x=left?kitchen.x:Math.max(kitchen.x,Math.floor((Math.min(...bounds.map(b=>b.x))-10)/4)*4),right=left?Math.min(kitchen.x+kitchen.w,Math.ceil((Math.max(...bounds.map(b=>b.x+b.w))+10)/4)*4):kitchen.x+kitchen.w;
 kitchen.floorBounds={x,y:kitchen.y,w:right-x,h:Math.min(kitchen.y+kitchen.h,living.y)-kitchen.y};
 return scene;
}
