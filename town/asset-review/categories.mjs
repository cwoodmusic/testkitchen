/** Review-only navigation labels. Original catalog groups and assets stay intact. */
export const ASSET_CATEGORIES=Object.freeze([
 'Chairs','Tables','Beds','Sofas','Rugs','Carpets','Wallpapers','Floors',
 'Desks','Nightstands','Storage','Kitchen','Bathrooms','Decorations','Lighting',
 'Music & Instruments','Arcade Machines','Toys & Plushies','Plants & Pots',
 'Walls','Buildings','Trees','Garden & Outdoor','Picnic & Beach','Market & Food',
 'Streets & Paths','Waterfront','Terrain'
]);

const roles=Object.freeze({
 chair:'Chairs','reading-chair':'Chairs','desk-chair':'Chairs','dining-chair':'Chairs','dining-bench':'Chairs',bench:'Chairs',beanbag:'Chairs',cushion:'Chairs',
 table:'Tables','dining-table':'Tables','coffee-table':'Tables',bed:'Beds',sofa:'Sofas',desk:'Desks',nightstand:'Nightstands',
 storage:'Storage',wardrobe:'Storage',bookcase:'Storage',shelf:'Storage','wall-shelf':'Storage','linen-storage':'Storage','toy-storage':'Storage',
 sink:'Kitchen','kitchen-sink':'Kitchen',counter:'Kitchen','kitchen-counter':'Kitchen',stove:'Kitchen',fridge:'Kitchen',pantry:'Kitchen',
 vanity:'Bathrooms','bath-vanity':'Bathrooms','bath-fixture':'Bathrooms',shower:'Bathrooms',toilet:'Bathrooms',bathtub:'Bathrooms',
 'floor-lamp':'Lighting','table-lamp':'Lighting','lava-lamp':'Lighting',lamp:'Lighting',
 'record-console':'Music & Instruments','record-player':'Music & Instruments',instrument:'Music & Instruments',
 arcade:'Arcade Machines',toy:'Toys & Plushies',plush:'Toys & Plushies',plant:'Plants & Pots',rug:'Rugs',
 mirror:'Decorations',poster:'Decorations',clock:'Decorations','wall-clock':'Decorations','wall-art':'Decorations','table-decor':'Decorations',decoration:'Decorations',divider:'Decorations'
});
const synonyms=Object.freeze({
 Chairs:'chair chairs seating seat seats bench benches stool stools beanbag cushions lounger recliner armchair',
 Tables:'table tables dining coffee cafe picnic chess',Beds:'bed beds bedroom sleeping',Sofas:'sofa sofas couch couches loveseat settee seating',
 Rugs:'rug rugs mat mats bathroom bathmat blanket blankets quilt quilts floor covering',
 Carpets:'carpet carpets carpeting woven wall to wall wall-to-wall fitted bedroom floor flooring finish finishes',
 Wallpapers:'wallpaper wallpapers wall covering wallcovering wallcoverings wall finish finishes wall tile ceramic',
 Floors:'floor floors flooring finish finishes tiles tile wood timber parquet stone marble ceramic',
 Desks:'desk desks workbench workbenches writing workspace',Nightstands:'nightstand nightstands bedside table tables cabinet',
 Storage:'storage cabinet cabinets wardrobe wardrobes shelf shelves bookcase cupboard cupboards chest crates barrels',
 Kitchen:'kitchen kitchens cooking counter counters sink sinks stove oven refrigerator fridge pantry appliance appliances grill',
 Bathrooms:'bathroom bathrooms bath baths toilet toilets vanity shower showers bathtub tub washroom',
 Decorations:'decoration decorations decor ornament ornaments mirror mirrors clock clocks poster posters wall art picture frame sign',
 Lighting:'lighting light lights lamp lamps lantern lanterns sconce sconces glow neon',
 'Music & Instruments':'music musical instrument instruments piano organ keyboard strings brass wind percussion record player audio speakers microphone',
 'Arcade Machines':'arcade arcades machine machines cabinet games gaming',
 'Toys & Plushies':'toy toys plush plushie plushies stuffed animal animals model',
 'Plants & Pots':'plant plants pot pots planter planters flower flowers shrub shrubs bush bushes vine vines ivy fern foliage',
 Walls:'wall walls fence fences gate gates door doors window windows architecture balcony',
 Buildings:'building buildings house houses home homes estate estates shop store cottage gazebo structure structures',
 Trees:'tree trees oak pine willow cherry apple woodland',
 'Garden & Outdoor':'garden gardens outdoor outdoors yard courtyard fountain well statue sculpture pergola stage festival tools',
 'Picnic & Beach':'picnic beach leisure umbrella parasol cabana towel cooler basket outdoor',
 'Market & Food':'market vendor vendors stall stalls cart carts food drink produce bakery cheese coffee',
 'Streets & Paths':'street streets road roads path paths sidewalk pavement paving plaza markings city urban',
 Waterfront:'waterfront boat boats dock pier fishing canoe paddleboard anchor harbor harbour nautical',
 Terrain:'terrain ground landscape cliff cliffs rock rocks boulder grass water sand dirt moss roots'
});
const normalize=value=>String(value??'').trim().toLowerCase().replace(/[\s_]+/g,'-');
const text=value=>String(value??'').toLowerCase();

/** One semantic category, without reading artwork getters or modifying metadata. */
export function assetCategory(asset={}){
 const id=text(asset.id),name=text(asset.name),group=text(asset.group),finish=asset.materialFinish||{};
 // Finishes are materials, not furniture. A procedural carpet has no texture file.
 const wall=asset.finishKind==='wall'||id.startsWith('finish:wall:')||group==='interior walls'||['wall','wet-wall','wallpaper'].includes(finish.kind);
 if(wall)return 'Wallpapers';
 const floor=asset.finishKind==='floor'||id.startsWith('finish:floor:')||group==='interior floors'||['floor','carpet','wet-floor','kitchen-floor'].includes(finish.kind);
 if(floor)return finish.kind==='carpet'||finish.surfaceStyle==='carpet'||(!finish.kind&&/(?:^|[-:])carpet(?:$|[-:])/.test(text(asset.finishId||finish.id||id)))?'Carpets':'Floors';
 if(group==='room rugs'||id.startsWith('room-rug-'))return 'Rugs';
 // The owning collection can contain words such as "bedroom" or "kitchen".
 // Exact object roles always win over those style/owner names and source packs.
 for(const value of [asset.slot,asset.purpose,asset.furnitureRole]){
  const kind=normalize(value);if(Object.hasOwn(roles,kind))return roles[kind];
 }
 if(id.startsWith('surface:'))return 'Terrain';
 if(['houses','home estates','urban buildings'].includes(group)||['coda-arcade','sydney-opera-house'].includes(id))return 'Buildings';
 if(id==='music-square')return 'Streets & Paths';
 if(group==='plushies'||id.startsWith('plush-'))return 'Toys & Plushies';
 // Match the principal object, not accessories: "bagpipes on stool" is music.
 const head=name.split(/\s+(?:on|in|with)\s+/)[0];
 if(/\b(?:workbench|work bench|luthier bench|repair bench|potting bench|writing desk)\b/.test(head))return 'Desks';
 if(['strings','keys and percussion','brass and winds'].includes(group))return 'Music & Instruments';
 if(/\b(?:lamp|lantern|sconce|uplight|lights|lighting|light|neon)\b/.test(head)||group.includes('lighting'))return 'Lighting';
 if(/\b(?:sofa|loveseat|settee|chesterfield|couch|settle)\b/.test(head))return 'Sofas';
 if(/\bbed\b/.test(head))return 'Beds';
 if(/\b(?:rug|rugs|blanket|blankets|quilt|towel|towels)\b/.test(head))return 'Rugs';
 if(/\b(?:nightstand|bedside)\b/.test(head))return 'Nightstands';
 if(/\b(?:table|tables)\b/.test(head))return 'Tables';
 if(/\bdesk\b/.test(head)&&!head.includes('mixing desk'))return 'Desks';
 if(/\b(?:chair|chairs|bench|benches|stool|lounger|beanbag)\b/.test(head))return 'Chairs';
 if(/\b(?:toilet|vanity|shower|bathtub)\b/.test(head))return 'Bathrooms';
 if(/\b(?:counter|stove|fridge|refrigerator|freezer|pantry|kitchen sink|grill)\b/.test(head))return 'Kitchen';
 if(/\b(?:cabinet|bookcase|credenza|cubby|wardrobe|shelf|storage|chest|trunk)\b/.test(head)||group==='containers')return 'Storage';
 if(/\b(?:sign|signpost|signboard|notice board|plaque|relief|sculpture|monument|artboard|poster|mirror|clock|marquee|bracket)\b/.test(head))return 'Decorations';
 if(group==='music workshop'||/\b(?:piano|organ|keyboard|synthesizer|guitar|radio|record player|record console|turntable|instrument|wind chimes)\b/.test(head))return 'Music & Instruments';
 if(/\b(?:gazebo|cabana|changing hut|shed|coop|hutch)\b/.test(head))return 'Buildings';
 if(group==='garden pots')return 'Plants & Pots';
 if(group==='waterfront'||/\b(?:paddleboard|rowboat|skiff|canoe)\b/.test(head))return 'Waterfront';
 if(/\b(?:fountain|wishing well)\b/.test(head))return 'Garden & Outdoor';
 if(group==='architectural details'||/\b(?:wall|fence|gate|door|window|balcony|dormer|chimney|cupola)\b/.test(head)||id.startsWith('music-square-wall'))return 'Walls';
 if(/\b(?:rock|rocks|boulder|boulders|ledge|cliff section|stump)\b/.test(head)||group==='ground textures')return 'Terrain';
 if(group==='garden features')return 'Garden & Outdoor';
 if(/\b(?:planter|pot|monstera|fern|ferns|ivy|rose|roses|wisteria|honeysuckle|shrubs|shrub|bush|vine|roots|overgrowth)\b/.test(head)||['foliage and rocks','overgrowth'].includes(group))return 'Plants & Pots';
 if(group==='trees'||/\btree\b/.test(head))return 'Trees';
 if(group.startsWith('urban ')||group==='street furniture')return 'Streets & Paths';
 if(group==='market goods'||/\b(?:food|popcorn|cotton-candy|ticket booth|produce stall)\b/.test(head))return 'Market & Food';
 if(['picnic','beach'].includes(group))return 'Picnic & Beach';
 if(group==='landscape')return 'Terrain';
 if(group==='cliff faces'||group==='cliff decorations')return 'Plants & Pots';
 if(group==='construction')return 'Streets & Paths';
 if(['props','garden features','farm and utility','festival','festival staging'].includes(group))return 'Garden & Outdoor';
 return 'Decorations';
}

/** Extra discovery words; pack/group remain separately available to the caller. */
export function categorySearchTerms(asset){
 const category=assetCategory(asset);
 return (category+' '+synonyms[category]).toLowerCase();
}
