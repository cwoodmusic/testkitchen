import {APARTMENT_COLLECTIONS} from './apartment-collection-definitions.mjs?v=wall-caps-1';

// New larger products have their own physical geometry. Approved collection
// furniture, owned items and existing catalog dimensions remain unchanged.
const shapes=Object.freeze({
 'dining-table':{name:'Family dining table · seats 6–8',w:260,h:160,base:[8,68,244,84],seats:8,art:'extended-table'},
 'coffee-table':{name:'Broad low coffee table',w:210,h:108,base:[10,34,190,70],art:'extended-table'},
 rug:{name:'Grand living-room area rug',w:420,h:280,art:'collection-source'},
 plant:{name:'Statement indoor tree',w:138,h:216,base:[30,165,78,45],art:'collection-source'}
});
export const FAMILY_FURNITURE_SLOTS=Object.freeze(Object.keys(shapes));
export const FAMILY_FURNITURE_ASSETS=Object.freeze(APARTMENT_COLLECTIONS.flatMap(collection=>FAMILY_FURNITURE_SLOTS.map(slot=>{
 const shape=shapes[slot],base=shape.base;
 return Object.freeze({id:'family-'+collection.owner+'-'+slot,owner:collection.owner,collectionOwner:collection.owner,apartmentCollection:collection.owner,slot,purpose:slot,furnitureRole:slot,
  name:collection.label+' · '+shape.name,style:collection.style,variant:'family-room',pack:'family-room-124',w:shape.w,h:shape.h,
  boxes:Object.freeze(base?[Object.freeze({x:base[0],y:base[1],w:base[2],h:base[3]})]:[]),solid:!!base,wallMounted:false,layer:slot==='rug'?'ground':'objects',
  sourceAssetId:'collection-'+collection.owner+'-'+slot,art:shape.art,...(shape.seats?{seats:shape.seats}:{}),
  visualSignature:[collection.owner,'family-room',slot,collection.materials,collection.motif,'separate generous-scale product'].join(' | ')});
})));
const byKey=new Map(FAMILY_FURNITURE_ASSETS.map(asset=>[asset.owner+'|'+asset.slot,asset]));
export function getFamilyFurniture(owner,slot){const result=byKey.get(owner+'|'+slot);if(!result)throw Error('Unknown family-room product: '+owner+'/'+slot);return result;}
