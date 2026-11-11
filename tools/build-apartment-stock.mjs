import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {APARTMENT_COLLECTIONS} from '../town/world/apartment-collection-definitions.mjs';

const prices={"bed":32000,"sofa":28000,"wardrobe":24000,"nightstand":7000,"desk":20000,"desk-chair":6500,"reading-chair":12000,"dining-table":18000,"dining-chair":6000,"coffee-table":10000,"sink":24000,"stove":22000,"fridge":30000,"counter":18000,"pantry":16000,"toilet":9000,"vanity":16000,"bath-fixture":28000,"linen-storage":9000,"mirror":5000,"shelf":6500,"record-console":48000,"floor-lamp":12000,"table-lamp":6500,"rug":8000,"poster":2500,"toy":3000,"lava-lamp":9500,"arcade":75000,"instrument":100000,"plant":3500,"clock":4500};
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
