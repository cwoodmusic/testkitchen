import {SHOWROOM_FURNITURE} from './showroom-furniture-definitions.mjs?v=apartment-scale-2';

// World canvases stay stable independently of generated image proportions.
// Registration contains each native cutout at the bottom-center anchor.
const rows=[
 ['teak-bed','Teak platform bed','bed',150,150,[8,60,134,87]],
 ['box-sofa','Olive tapered-leg sofa','sofa',180,126,[10,74,160,50]],
 ['walnut-credenza','Walnut sliding-door credenza','storage',180,122,[10,66,160,52]],
 ['kidney-coffee-table','Kidney-shaped walnut coffee table','coffee-table',140,86,[10,34,120,50]],
 ['molded-lounge-chair','Molded walnut lounge chair','chair',84,114,[8,70,68,40]],
 ['arc-floor-lamp','Brass arc floor lamp','floor-lamp',152,190,[10,166,42,22]],
 ['starburst-clock','Atomic starburst clock','wall-clock',96,96,null],
 ['tambour-record-console','Teak tambour record console','record-console',180,124,[10,72,160,48]],
 ['mushroom-lamp','Amber mushroom table lamp','table-lamp',52,72,[10,54,32,16]],
 ['geometric-room-divider','Geometric teak room divider','divider',150,180,[10,146,130,30]],
 ['teak-desk','Streamlined teak writing desk','desk',160,114,[8,62,144,48]],
 ['round-dining-table','Round teak dining table','dining-table',116,112,[12,58,92,50]],
 ['molded-dining-chair','Pastel molded dining chair','dining-chair',64,100,[8,65,48,32]],
 ['pastel-fridge','Mint retro refrigerator','fridge',86,150,[8,96,70,50]],
 ['low-bookcase','Low walnut bookcase','bookcase',148,124,[8,76,132,44]],
 ['record-player','Walnut record player','record-player',70,72,[4,48,62,22]],
 ['fox-plush','Fox music-friend plush','plush',60,72,[9,48,42,22]],
 ['axolotl-plush','Pink axolotl plush','plush',58,62,[8,40,42,20]],
 ['checkered-beanbag','Mint checkerboard beanbag','beanbag',96,86,[9,40,78,42]],
 ['moon-star-cushions','Moon and star floor cushions','cushion',86,84,[9,48,68,32]],
 ['record-rug','Vinyl-record music rug','rug',160,160,null],
 ['rainbow-keys-rug','Rainbow piano-key rug','rug',180,104,null],
 ['solar-system-model','Little solar-system model','table-decor',64,90,[10,68,44,20]],
 ['headphones-books','Headphones and favorite books','table-decor',64,64,[6,40,52,22]],
 ['cassette-cubby','Cassette and record cubby','storage',108,126,[8,78,92,44]],
 ['sticker-suitcase','Music-sticker suitcase','decoration',56,90,[8,60,40,26]],
 ['origami-artboard','Origami bird artboard','wall-art',108,100,null],
 ['cat-planter','Cat-shaped plant pot','plant',58,78,[10,54,38,22]],
 ['patchwork-wall-art','Patchwork music wall art','wall-art',128,128,null],
 ['monstera','Terracotta monstera','plant',92,144,[20,110,52,30]],
 ['fern-planter','Striped fern planter','plant',96,122,[18,90,60,28]],
 ['lava-lamp','Periwinkle lava lamp','table-lamp',52,110,[12,90,28,18]],
 ['sink-counter','Sage kitchen sink counter','kitchen-sink',112,112,[8,64,96,44]],
 ['corner-kitchen-counter','Oak corner kitchen counter','kitchen-counter',128,112,[8,54,112,54]],
 ['cream-stove','Cream enamel stove','stove',84,116,[8,70,68,42]],
 ['blue-fridge','Powder-blue fridge freezer','fridge',86,150,[8,96,70,50]],
 ['bath-vanity','Oak bathroom vanity','bath-vanity',80,106,[8,66,64,36]],
 ['glass-shower','Glass shower stall','shower',98,154,[8,100,82,50]],
 ['toilet','White ceramic toilet','toilet',52,86,[8,48,36,34]],
 ['bathtub','Compact brass-fixture bathtub','bathtub',128,126,[8,68,112,54]],
 ['wardrobe','Walnut wardrobe','wardrobe',128,184,[10,126,108,54]],
 ['nightstand','Sage bedside nightstand','nightstand',62,78,[6,44,50,30]],
 ['desk-chair','Coral wooden-leg desk chair','desk-chair',62,94,[8,60,46,30]],
 ['toy-chest','Oak cushioned toy chest','toy-storage',96,84,[8,46,80,34]],
 ['reading-lamp','Slim brass reading lamp','floor-lamp',80,158,[16,136,28,18]],
 ['wall-shelf','Walnut books and plant shelf','wall-shelf',128,84,null],
 ['round-mirror','Round brass wall mirror','mirror',88,96,null],
 ['dining-bench','Sage oak dining bench','dining-bench',136,100,[8,58,120,38]]
];
const wallPurposes=new Set(['wall-clock','wall-art','wall-shelf','mirror']);
export const APARTMENT_DECOR=Object.freeze(rows.map(([suffix,name,purpose,w,h,box],index)=>Object.freeze({
 id:'apartment-'+suffix,name,purpose,w,h,
 category:index<16?'midcentury':index<32?'playful':'practical',
 atlas:index<16?'midcentury-atlas.png':index<32?'playful-atlas.png':'practical-atlas.png',
 atlasIndex:index%16,file:suffix+'.png',
 boxes:Object.freeze(box?[Object.freeze({x:box[0],y:box[1],w:box[2],h:box[3]})]:[]),
 solid:!!box,wallMounted:wallPurposes.has(purpose),layer:purpose==='rug'?'ground':'objects'
})));

// Existing purchased IDs, dimensions and physical geometry remain authoritative.
// Only their image source changes to the new clean-lined midcentury designs.
export const APARTMENT_DECOR_ALIASES=Object.freeze([
 ['showroom-midcentury-studio-bed','apartment-teak-bed'],
 ['showroom-midcentury-studio-sofa','apartment-box-sofa']
].map(([id,aliasOf])=>{
 const source=SHOWROOM_FURNITURE.find(def=>def.id===id);
 return Object.freeze({...source,purpose:source.role,category:'midcentury',aliasOf,file:'alias-'+source.file,solid:true,layer:'objects'});
}));
