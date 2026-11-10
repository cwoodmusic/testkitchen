import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {APARTMENT_COLLECTIONS} from '../town/world/apartment-collection-definitions.mjs';

const prices={bed:80,sofa:70,wardrobe:50,nightstand:25,desk:55,'desk-chair':25,'reading-chair':35,'dining-table':60,'dining-chair':25,'coffee-table':35,sink:65,stove:55,fridge:70,counter:55,pantry:45,toilet:30,vanity:40,'bath-fixture':65,'linen-storage':35,mirror:22,shelf:25,'record-console':100,'floor-lamp':45,'table-lamp':25,rug:32,poster:18,toy:20,'lava-lamp':38,arcade:110,instrument:180,plant:25,clock:28};
const category=slot=>['sink','stove','fridge','counter'].includes(slot)?'kitchen':['toilet','vanity','bath-fixture'].includes(slot)?'bathroom':['wardrobe','pantry','linen-storage','shelf','record-console'].includes(slot)?'storage':['floor-lamp','table-lamp','lava-lamp'].includes(slot)?'lighting':slot==='rug'?'rugs':slot==='plant'?'plants':slot==='instrument'?'instruments':['poster','toy','clock','mirror','arcade'].includes(slot)?'decorations':'furniture';
const rows=APARTMENT_COLLECTIONS.filter(c=>c.owner.startsWith('showroom-')).flatMap(c=>c.assets.map(a=>[a.id,a.name,prices[a.slot],a.id,category(a.slot),a.wallMounted?.75:1,c.owner]));
const begin='  // BEGIN GENERATED APARTMENT COLLECTION PRODUCTS';
const end='  // END GENERATED APARTMENT COLLECTION PRODUCTS';
const target=fileURLToPath(new URL('../furniture-catalog.js',import.meta.url));
const current=readFileSync(target,'utf8');
if(!current.includes(begin)||!current.includes(end))throw Error('Furniture catalogue collection markers are missing.');
const fragment=begin+'\n'+rows.map(row=>'  '+JSON.stringify(row)).join(',\n')+'\n'+end;
const next=current.slice(0,current.indexOf(begin))+fragment+current.slice(current.indexOf(end)+end.length);
if(process.argv.includes('--check')){
 if(next!==current)throw Error('Furniture collection stock is stale. Run node tools/build-apartment-stock.mjs.');
 console.log('Apartment collection stock matches all '+rows.length+' unique showroom pieces.');
}else{writeFileSync(target,next);console.log('Generated '+rows.length+' unique showroom products.');}
