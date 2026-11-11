import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {FAMILY_FURNITURE_ASSETS} from '../town/world/family-furniture-definitions.mjs';
import {APARTMENT_COLLECTIONS} from '../town/world/apartment-collection-definitions.mjs';

const prices={"bed":32000,"sofa":28000,"wardrobe":24000,"nightstand":7000,"desk":20000,"desk-chair":6500,"reading-chair":12000,"dining-table":18000,"dining-chair":6000,"coffee-table":10000,"sink":24000,"stove":22000,"fridge":30000,"counter":18000,"pantry":16000,"toilet":9000,"vanity":16000,"bath-fixture":28000,"linen-storage":9000,"mirror":5000,"shelf":6500,"record-console":48000,"floor-lamp":12000,"table-lamp":6500,"rug":8000,"poster":2500,"toy":3000,"lava-lamp":9500,"arcade":75000,"instrument":100000,"plant":3500,"clock":4500};
const category=slot=>['sink','stove','fridge','counter'].includes(slot)?'kitchen':['toilet','vanity','bath-fixture'].includes(slot)?'bathroom':['wardrobe','pantry','linen-storage','shelf','record-console'].includes(slot)?'storage':['floor-lamp','table-lamp','lava-lamp'].includes(slot)?'lighting':slot==='rug'?'rugs':slot==='plant'?'plants':slot==='instrument'?'instruments':['poster','toy','clock','mirror','arcade'].includes(slot)?'decorations':'furniture';
const rows=APARTMENT_COLLECTIONS.filter(c=>c.owner.startsWith('showroom-')).flatMap(c=>c.assets.map(a=>[a.id,a.name,prices[a.slot],a.id,category(a.slot),a.wallMounted?.75:1,c.owner]));
// Named, previewable keepsakes: these are musical toys, not soft plushes.
const musicalFriends=[
 ['bach','Woodland organ music box',6000],['mozart','Pink conductor bird',6500],
 ['beethoven','Lightning wind-up bird',7500],['clara','Leafy owl keyboard',5500],
 ['chopin','Moon-cat music box',7000],['haydn','Sunflower songbird',4500],
 ['handel','Laurel wind-up songbird',6000],['vivaldi','Autumn songbird',5500],
 ['joplin','Ragtime drummer squirrel',7000],['ellington','Bluebird jazz music box',7000],
 ['ella','Honeysuckle singing bird',5500],['nina','Cedar xylophone friend',6000],
 ['miles','Brass headphone bird',7500],['dj','Neon owl DJ',10000],
 ['vee-jay','Prism keyboard robot',12000],['zizi','Moon-garden keyboard friend',8500],
 ['metronome','Clockwork owl music box',6500],['schoenberg','Wooden keyboard rabbit',6000],
 ['player','Cloud keyboard friend',10000]
];
const plushFriends=[
 ['plush-headphone-whale','Headphone Whale',8000],['plush-lavender-dragon','Lavender Dragon',12000],
 ['plush-ukulele-capybara','Ukulele Capybara',10000],['plush-starry-bunny','Starry Bunny',6000],
 ['plush-strawberry-frog','Strawberry Frog',6500],['plush-red-panda','Sleepy Red Panda',7500],
 ['plush-cloud-cat','Cloud Cat',6500],['plush-sun-lion','Sunshine Lion',7000],
 ['plush-mint-robot','Soft Mint Robot',9000],['plush-moon-owl','Moon Owl',7000],
 ['plush-mushroom-friend','Mushroom Friend',4500],['plush-bluebird','Little Songbird',4000]
];
const playfulRows=[
 ...musicalFriends.map(([owner,name,price])=>{
  const asset=APARTMENT_COLLECTIONS.find(c=>c.owner===owner)?.assets.find(a=>a.slot==='toy');
  if(!asset)throw Error('A musical friend must use an existing native toy: '+owner);
  return [asset.id,name,price,asset.id,'playful decor',1,owner];
 }),
 ...plushFriends.map(([asset,name,price])=>[asset,name,price,asset,'plushies',1])
];
const begin='  // BEGIN GENERATED APARTMENT COLLECTION PRODUCTS';
const end='  // END GENERATED APARTMENT COLLECTION PRODUCTS';
const target=fileURLToPath(new URL('../furniture-catalog.js',import.meta.url));
const current=readFileSync(target,'utf8');
if(!current.includes(begin)||!current.includes(end))throw Error('Furniture catalogue collection markers are missing.');
const fragment=begin+'\n'+rows.map(row=>'  '+JSON.stringify(row)).join(',\n')+'\n'+end;
const playfulBegin='  // BEGIN GENERATED PLAYFUL DECOR PRODUCTS',playfulEnd='  // END GENERATED PLAYFUL DECOR PRODUCTS';
if(!current.includes(playfulBegin)||!current.includes(playfulEnd))throw Error('Furniture catalogue playful-decor markers are missing.');
const collectionText=current.slice(0,current.indexOf(begin))+fragment+current.slice(current.indexOf(end)+end.length);
const playfulFragment=playfulBegin+'\n'+playfulRows.map(row=>'  '+JSON.stringify(row)).join(',\n')+'\n'+playfulEnd;
let next=collectionText.slice(0,collectionText.indexOf(playfulBegin))+playfulFragment+collectionText.slice(collectionText.indexOf(playfulEnd)+playfulEnd.length);
const familyPrices={'dining-table':42000,'coffee-table':22000,rug:24000,plant:12000};
const familyRows=FAMILY_FURNITURE_ASSETS.map(a=>[a.id,a.name,familyPrices[a.slot],a.id,category(a.slot),1,a.owner]);
const familyBegin='  // BEGIN GENERATED FAMILY ROOM PRODUCTS',familyEnd='  // END GENERATED FAMILY ROOM PRODUCTS';
if(!next.includes(familyBegin)||!next.includes(familyEnd))throw Error('Family-room stock markers are missing.');
const familyFragment=familyBegin+'\n'+familyRows.map(row=>'  '+JSON.stringify(row)).join(',\n')+'\n'+familyEnd;
next=next.slice(0,next.indexOf(familyBegin))+familyFragment+next.slice(next.indexOf(familyEnd)+familyEnd.length);
if(process.argv.includes('--check')){
 if(next!==current)throw Error('Furniture collection stock is stale. Run node tools/build-apartment-stock.mjs.');
 console.log('Apartment stock matches '+rows.length+' showroom pieces and '+playfulRows.length+' named playful keepsakes and '+familyRows.length+' family-room products.');
}else{writeFileSync(target,next);console.log('Generated '+rows.length+' showroom products and '+playfulRows.length+' named playful keepsakes and '+familyRows.length+' family-room products.');}
