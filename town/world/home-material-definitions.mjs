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
// Quiet the busiest dry-floor inlays so furniture retains the visual focus.
const dryFloorGlazes={bach:.28,vivaldi:.30,ella:.18};
const freeze=value=>{if(value&&typeof value==='object'){for(const part of Object.values(value))freeze(part);Object.freeze(value);}return value;};
const finish=(owner,kind,name,colors,extra={})=>({id:`${owner}-${kind}`,name,label:name,pattern:`home-${owner}-${kind}`,homeMaterial:true,owner,kind,colors,texture:`${owner}-${kind==='wet-wall'?'wet-floor':kind}.webp`,...extra});
export const HOME_MATERIAL_SUITES=freeze(rows.map(([owner,name,floorName,wallName,wetName,colors])=>({
 owner,id:`home-suite-${owner}`,name,floor:finish(owner,'floor',floorName,colors,{glaze:dryFloorGlazes[owner]||0}),wallpaper:finish(owner,'wall',wallName,colors,{trimTexture:`${owner}-dado.webp`}),
 wetFloor:finish(owner,'wet-floor',wetName,colors),wetWallpaper:finish(owner,'wet-wall',wetName+' wall glaze',colors,{glazed:true}),
 trim:{wood:colors[0],light:colors[1],shadow:colors[2],metal:colors[3]},
 construction:{floor:floorName,wall:wallName,wet:wetName},
 assets:[`${owner}-floor.webp`,`${owner}-wall.webp`,`${owner}-wet-floor.webp`,`${owner}-dado.webp`]
})));
const byOwner=new Map(HOME_MATERIAL_SUITES.map(suite=>[suite.owner,suite]));
export const getHomeMaterialSuite=owner=>byOwner.get(owner)||null;

/** Surface metadata only: every rectangle, collider, item and route is retained. */
export function applyHomeMaterialSuite(scene,owner){
 const suite=getHomeMaterialSuite(owner);if(!suite)return scene;
 scene.homeMaterialSuite=suite;scene.collectionOwner??=owner;
 scene.color=suite.wallpaper.colors[0];scene.trim=suite.trim.light;
 for(const room of scene.rooms){
  const wet=room.functionalRole==='bathroom'||/bathroom/i.test(room.name);
  room.floorFinish=wet?suite.wetFloor:suite.floor;room.wallpaper=wet?suite.wetWallpaper:suite.wallpaper;
  // Existing north-wall bands are render-only architectural metadata.
  // Never borrow walkable floor to invent a new wall face.
  room.wallpaperAreas??=room.y<=112?[{x:room.x,y:0,w:room.w,h:106}]:[];
 }
 for(const wall of scene.walls){wall.color=suite.trim.wood;wall.trim=suite.trim.light;}
 for(const door of scene.privacyDoors||[]){door.color=suite.trim.wood;door.trim=suite.trim.light;}
 return scene;
}
