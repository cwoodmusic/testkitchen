// Every owner has a complete independently drawn collection. Slots are unique
// within a home; the original shop assets remain separate purchase-compatible
// products. World sizes are independent of the native atlas cell proportions.
const owners=[
 ['bach','Bach · Organ Loft','organ-loft','dark oak, forest velvet, antique brass','arched organ-pipe headboard','straight high-backed oak settle','Gothic arches, organ pipes and tiny carved leaves','shower'],
 ['mozart','Mozart · Rosewood Salon','rosewood-salon','rosewood, rose linen, ivory enamel','scalloped ribbon headboard','slender ribbon-back settee','ribbon loops, tiny theatrical stars and scalloped edges','shower'],
 ['beethoven','Beethoven · Stormlight','stormlight','blackened steel, navy wool, smoked ash','asymmetric steel-and-ash slab bed','broad angular leather sectional','lightning-shaped joinery, rain marks and rugged rivets','shower'],
 ['clara','Clara · Fern and Ivory','fern-ivory','pale birch, woven cane, fern-green linen','woven fern-arch cane bed','soft birch-frame slipcovered sofa','fern-shaped cane panels and delicate ivory curves','shower'],
 ['chopin','Chopin · Nocturne','nocturne','polished mahogany, lavender velvet, mother of pearl','low crescent sleigh bed','delicate curled mahogany chaise-sofa','moon inlay, slender curves and pearly stars','shower'],
 ['haydn','Haydn · Sunflower Suite','sunflower','pegged honey pine, butter linen, terracotta','pegged farmhouse bed with sunflower crest','sturdy pine spindle-back sofa','sunflower cutouts, pegs and cheerful quilt blocks','shower'],
 ['handel','Handel · Laurel Rooms','laurel','warm walnut, olive damask, muted gilding','laurel-crowned column bed','rounded pedestal-frame olive sofa','laurel wreath carving and broad classical columns','shower'],
 ['vivaldi','Vivaldi · Four Seasons','four-seasons','cherry wood, autumn red, leafy green','branch-and-leaf cherry bed','leaf-arm cherry bench sofa','four-season leaf shapes and turned branch-like legs','shower'],
 ['joplin','Joplin · Maple Ragtime','maple-ragtime','maple, rust upholstery, cream and indigo','stepped piano-key maple bed','boxy maple-backed ragtime sofa','syncopated steps, piano-key inlay and brass corners','shower'],
 ['ellington','Ellington · Bluebird Jazz','bluebird','waterfall walnut, peacock velvet, brushed brass','radiating fan-shaped waterfall bed','sweeping Art Deco crescent sofa','bluebird wing curves, waterfall veneer and fan rays','shower'],
 ['ella','Ella · Honeysuckle Lounge','honeysuckle','honey oak, coral boucle, creamy silk','rounded cloud-petal upholstered bed','plump curved coral boucle sofa','honeysuckle petals, soft loops and pearl piping','bathtub'],
 ['nina','Nina · Cedar Sanctuary','cedar-sanctuary','cedar, terracotta woven fabric, earthy sage','low cedar block-platform bed','angular cedar-frame woven sofa','woven sun disks, earthy stepped blocks and broad slats','bathtub'],
 ['miles','Miles · Midnight Brass','midnight-brass','smoked walnut, midnight leather, cool brass','low capsule-shaped leather bed','asymmetric knife-edge midnight sofa','brass trumpet curves, long horizontal slots and smoked glass','bathtub'],
 ['dj','DJ Coda · Nightjar Studio','nightjar','black lacquer, violet velvet, cyan acrylic','wave-shaped cassette-headboard bed','modular rounded violet lounge sofa','equalizer fins, cassette geometry and soft neon strips','bathtub'],
 ['vee-jay','Vee Jay · Prism Video Loft','prism-video','mint lacquer, translucent lilac acrylic, silver','rounded cube-frame prism bed','curved mint pod sofa','prismatic cutouts, rounded screen frames and stacked cubes','bathtub'],
 ['zizi','Zizi · Orbit Garden','orbit-garden','white bent plywood, lilac linen, fresh moss','crescent-leaf bent-ply bed','open crescent-shaped garden sofa','orbit rings, sprouting leaves and rounded lunar forms','bathtub'],
 ['metronome','Metronome · Clockwork Rooms','clockwork','hickory, burnished copper, warm cream','pendulum-arch hickory bed','mechanical spindle-and-copper sofa','visible wooden gears, tick marks and pendulum arches','bathtub'],
 ['schoenberg','Schoenberg · Twelve-Tone Atelier','twelve-tone','ash plywood, muted primary textiles, charcoal steel','offset geometric panel bed','asymmetric modular block sofa','twelve-part geometry, abstract grids and irregular balanced blocks','bathtub'],
 ['player','Your Apartment · Comet Club','comet-club','warm maple, rainbow patchwork, cream boucle','half-moon cloud platform bed','cozy comet-tail curved sofa','comet trails, playful patchwork and little creator-tool details','bathtub'],
 ['showroom-victorian-parlor','Velvet Music Parlor','velvet-parlor','carved chestnut, plum velvet, soft antique gold','carved oval medallion chestnut bed','buttoned serpentine plum sofa','oval cameos, turned tulip legs and musical scrollwork','bathtub'],
 ['showroom-art-deco-lounge','Starlight Deco Apartment','starlight-deco','ebony veneer, emerald velvet, champagne brass','stepped skyscraper headboard bed','faceted angular emerald sofa','skyscraper steps, geometric sunbursts and fluted panels','bathtub'],
 ['showroom-coastal-bedroom','Seashell Harbor Apartment','seashell-harbor','whitewashed oak, pale aqua linen, woven rope','shell-fan whitewashed bed','open rope-arm coastal sofa','shell scallops, rope loops and soft pebble shapes','shower'],
 ['showroom-rustic-kitchen','Honeybee Cottage Apartment','honeybee-cottage','knotted pine, golden gingham, cream enamel','honeycomb-panel cottage bed','chunky cross-braced gingham sofa','honeycomb joinery, cross braces and carved bee-wing details','bathtub'],
 ['showroom-botanical-conservatory','Glasshouse Fern Apartment','glasshouse-fern','arched rattan, sage velvet, pale stone','leaf-canopy rattan bed','double-arch rattan conservatory sofa','trellis arches, fern silhouettes and petal-shaped handles','shower'],
 ['showroom-midcentury-studio','Atomic Walnut Apartment','atomic-walnut','oiled walnut, teal wool, burnt orange, brushed brass','floating low walnut platform bed with offset slats','low teak-framed teal box sofa on splayed legs','true 1950s organic curves, tapered legs, kidney shapes and atomic stars','shower'],
 ['showroom-french-cafe','Patisserie Music Apartment','patisserie','painted cream beech, blush ticking, dark cafe wood','open heart-scroll cream beech bed','bistro spindle-backed blush settee','arched bistro frames, pastry scallops and delicate striped textiles','bathtub'],
 ['showroom-industrial-loft','Copper Workshop Apartment','copper-workshop','weathered oak, dark iron, caramel leather, copper','riveted iron gantry bed','channel-stitched caramel workshop sofa','exposed copper elbows, iron trusses, leather straps and riveted boxes','shower'],
 ['showroom-retrofuture','Retrofuture Spaceport Apartment','retrofuture-spaceport','warm cream molded fiberglass, tomato-orange vinyl, aqua acrylic, polished chrome','rounded capsule-shell bed with a sunrise headboard','low orange bubble-cushion sofa in a white crescent shell','capsule windows, rocket fins, orbital rings and playful antenna details','bathtub'],
 ['showroom-cyberpunk','Cyberpunk Neon Loft','cyberpunk-neon','ink-blue metal, smoky glass, plum upholstery, restrained cyan and magenta light','low charcoal platform bed with a split cyan circuit headboard','asymmetric plum modular sofa with an inset cyan light rail','layered circuit panels, translucent screens, cable channels and tiny neon music symbols','shower'],
 ['showroom-steampunk','Steampunk Clockwork Apartment','steampunk-clockwork','deep green velvet, mahogany, aged brass, oxblood leather','arched brass-and-mahogany bed with a clockwork crest','deep green leather-and-velvet sofa with brass scroll arms','pressure dials, engraved brass fittings, cog-shaped inlay and curved copper pipes','bathtub'],
 ['showroom-robot','Robot Companion Apartment','robot-companion','powder-blue enamel, warm ivory polymer, soft yellow fabric, brushed aluminum','rounded blue companion-pod bed with a friendly robot-face headboard','soft yellow segmented sofa with blue jointed robot arms','friendly indicator eyes, rounded control panels, jointed feet and little charging docks','shower']
];
const slots=[
 ['bed','bed',150,150,[8,60,134,87]],['sofa','sofa',180,126,[10,74,160,50]],
 ['wardrobe','wardrobe',128,184,[10,126,108,54]],['nightstand','nightstand',62,78,[6,44,50,30]],
 ['desk','desk',160,114,[8,62,144,48]],['desk-chair','desk-chair',62,94,[8,60,46,30]],
 ['reading-chair','chair',84,114,[8,70,68,40]],['dining-table','dining-table',116,112,[12,58,92,50]],
 ['dining-chair','dining-chair',64,100,[8,65,48,32]],['coffee-table','coffee-table',140,86,[10,34,120,50]],
 ['sink','kitchen-sink',112,112,[8,64,96,44]],['stove','stove',84,116,[8,70,68,42]],
 ['fridge','fridge',86,150,[8,96,70,50]],['counter','kitchen-counter',128,112,[8,54,112,54]],
 ['pantry','pantry',104,174,[8,124,88,46]],['toilet','toilet',52,86,[8,48,36,34]],
 ['vanity','bath-vanity',80,106,[8,66,64,36]],['bath-fixture','shower',98,154,[8,100,82,50]],
 ['linen-storage','linen-storage',90,150,[8,104,74,42]],['mirror','mirror',88,96,null],
 ['shelf','wall-shelf',128,84,null],['record-console','record-console',180,124,[10,72,160,48]],
 ['floor-lamp','floor-lamp',152,190,[10,166,42,22]],['table-lamp','table-lamp',52,72,[10,54,32,16]],
 ['rug','rug',180,112,null],['poster','wall-art',108,112,null],
 ['toy','table-decor',64,68,[8,46,48,20]],['lava-lamp','lava-lamp',52,110,[12,90,28,18]],
 ['arcade','arcade',100,176,[10,126,80,46]],['instrument','instrument',184,160,[14,104,156,52]],
 ['plant','plant',92,144,[20,110,52,30]],['clock','wall-clock',96,110,null]
];
const wall=new Set(['mirror','shelf','poster','clock']);
export const APARTMENT_COLLECTION_SLOTS=Object.freeze(slots.map(row=>row[0]));
const definitions=[];
export const APARTMENT_COLLECTIONS=Object.freeze(owners.map(([owner,label,style,materials,bedForm,sofaForm,motif,bathKind],index)=>{
 const collection={owner,label,style,index,materials,bedForm,sofaForm,motif,bathKind};
 collection.assets=Object.freeze(slots.map(([slot,purpose,width,height,baseBox],atlasIndex)=>{
  const bathtub=slot==='bath-fixture'&&bathKind==='bathtub',w=bathtub?128:width,h=bathtub?126:height,box=bathtub?[8,68,112,54]:baseBox;
  const asset=Object.freeze({id:`collection-${owner}-${slot}`,owner,collectionOwner:owner,apartmentCollection:owner,slot,purpose:bathtub?'bathtub':purpose,
   name:label+' · '+slot.replaceAll('-',' '),style,w,h,boxes:Object.freeze(box?[Object.freeze({x:box[0],y:box[1],w:box[2],h:box[3]})]:[]),solid:!!box,wallMounted:wall.has(slot),layer:slot==='rug'?'ground':'objects',
   atlasIndex,atlas:owner+'.webp',thumbnail:owner+'-thumb.webp',visualSignature:[owner,slot,materials,motif,slot==='bed'?bedForm:slot==='sofa'?sofaForm:'independently drawn '+slot].join(' | '),
   ...(slot==='lava-lamp'||slot==='arcade'?{motionKind:slot==='arcade'?'arcade':'lava'}:{})});
  definitions.push(asset);return asset;
 }));
 return Object.freeze(collection);
}));
export const APARTMENT_COLLECTION_ASSETS=Object.freeze(definitions);
export const APARTMENT_COLLECTION_OWNERS=Object.freeze(APARTMENT_COLLECTIONS.map(collection=>collection.owner));
const byOwner=new Map(APARTMENT_COLLECTIONS.map(collection=>[collection.owner,new Map(collection.assets.map(asset=>[asset.slot,asset]))]));
export function getApartmentAsset(owner,slot){
 const asset=byOwner.get(owner)?.get(slot);
 if(!asset)throw Error('Unknown apartment collection or slot: '+owner+'/'+slot);
 return asset;
}
export const getHomeAsset=getApartmentAsset;
