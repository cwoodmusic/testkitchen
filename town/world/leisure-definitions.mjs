// World dimensions use the town character scale. The artwork stays separate
// so a blanket, its basket, and each small picnic item remain movable.
const foot=(x,y,w,h)=>({x,y,w,h});
const ordinary=[foot(.17,.75,.66,.23)];
const pole=[foot(.43,.89,.14,.10)];
const flat={layer:'ground',solid:false};
const small={solid:false};
const item=(family,index,id,name,maxW,maxH,options={})=>Object.freeze({
 family,index,id,name,maxW,maxH,group:family,layer:'objects',solid:true,
 ...(family==='seating'?{worldCellSize:160,authoredFacing:true}:{}),
 ...options,feet:options.solid===false?[]:options.feet||ordinary
});

export const leisureFamilies=Object.freeze(['picnic','beach','seating']);
export const leisureSheetCounts=Object.freeze({picnic:16,beach:16,seating:8});
export const leisureDefinitions=Object.freeze([
 item('picnic',0,'picnic-blanket-gingham','Picnic blanket · red gingham',288,200,flat),
 item('picnic',1,'picnic-blanket-striped','Picnic blanket · blue woven stripes',288,200,flat),
 item('picnic',2,'picnic-quilt-patchwork','Picnic blanket · golden patchwork quilt',288,208,flat),
 item('picnic',3,'picnic-folded-blankets','Folded picnic blanket stack',104,80,small),
 item('picnic',4,'picnic-basket-closed','Closed wicker picnic basket',88,88),
 item('picnic',5,'picnic-basket-open','Open lined picnic basket with food',104,96),
 item('picnic',6,'picnic-hamper','Tall latched wicker picnic hamper',88,112),
 item('picnic',7,'picnic-cooler','Vintage cream and teal picnic cooler',112,96),
 item('picnic',8,'picnic-lunch-bag','Sage canvas picnic lunch bag',72,88),
 item('picnic',9,'picnic-cheese-board','Baguette, cheese and grape board',112,72,small),
 item('picnic',10,'picnic-lemonade','Lemonade pitcher and two tumblers',72,56,small),
 item('picnic',11,'picnic-thermos','Thermos and two enamel cups',64,50,small),
 item('picnic',12,'picnic-grill','Portable charcoal picnic grill',104,112),
 item('picnic',13,'picnic-lantern','Brass camping lantern',40,64,{
  feet:[foot(.26,.82,.48,.16)],
  lightEmitters:[{u:.5,v:.46,groundU:.5,groundV:.98,kind:'lamp',radius:155,power:.62,color:[255,208,139]}]
 }),
 item('picnic',14,'picnic-guitar-case','Travel guitar in an open padded case',112,216,small),
 item('picnic',15,'picnic-radio','Burgundy portable picnic radio',88,80),

 item('beach',0,'beach-umbrella-teal','Teal and cream round beach umbrella',288,320,{feet:pole}),
 item('beach',1,'beach-parasol-red','Red and ivory scalloped beach parasol',288,320,{feet:pole}),
 item('beach',2,'beach-cabana','Open-front canvas beach cabana',448,416,{
  feet:[foot(.08,.67,.08,.11),foot(.84,.67,.08,.11),foot(.08,.88,.08,.11),foot(.84,.88,.08,.11)]
 }),
 // The original sheet's two generic seats are replaced by the eight authored
 // directional views below; rotating an overhead sprite would invert it.
 item('beach',5,'beach-towel-striped','Empty red striped beach towel',128,240,flat),
 item('beach',6,'beach-towels-rolled','Rolled beach towel bundle',112,88,small),
 item('beach',7,'beach-bag-hat','Straw beach bag and sunhat',120,128,{feet:[foot(.34,.76,.44,.21)]}),
 item('beach',8,'beach-lifeguard-chair','Elevated white lifeguard chair',176,288,{feet:[foot(.20,.80,.60,.18)]}),
 item('beach',9,'beach-changing-hut','Teal beach changing hut',224,336,{feet:[foot(.15,.70,.70,.28)]}),
 item('beach',10,'beach-ball','Striped beach ball',72,88,small),
 item('beach',11,'beach-sandcastle','Sandcastle with bucket and shovel',192,160,{feet:[foot(.22,.73,.56,.24)]}),
 item('beach',12,'beach-paddleboard','Wooden paddleboard and paddle',136,304,flat),
 item('beach',13,'beach-life-ring','Life ring on a wooden stand',112,192,{feet:[foot(.30,.84,.40,.14)]}),
 item('beach',14,'beach-driftwood-planter','Driftwood and dune grass planter',240,192,{feet:[foot(.12,.77,.76,.20)]}),
 item('beach',15,'beach-volleyball-net','Beach volleyball net with timber posts',640,336,{
  feet:[foot(.04,.87,.08,.12),foot(.88,.87,.08,.12),foot(.12,.93,.76,.045)]
 }),

 item('seating',0,'beach-deck-chair-north','Folding beach chair · north',152,192,{group:'beach',facing:'north',feet:[foot(.20,.61,.60,.35)]}),
 item('seating',1,'beach-deck-chair-east','Folding beach chair · east',192,176,{group:'beach',facing:'east',feet:[foot(.16,.66,.70,.30)]}),
 item('seating',2,'beach-deck-chair-south','Folding beach chair · south',152,192,{group:'beach',facing:'south',feet:[foot(.20,.61,.60,.35)]}),
 item('seating',3,'beach-deck-chair-west','Folding beach chair · west',192,176,{group:'beach',facing:'west',feet:[foot(.14,.66,.70,.30)]}),
 item('seating',4,'beach-lounger-north','Teak beach lounger · north',176,224,{group:'beach',facing:'north',feet:[foot(.18,.53,.64,.43)]}),
 item('seating',5,'beach-lounger-east','Teak beach lounger · east',256,176,{group:'beach',facing:'east',feet:[foot(.16,.62,.68,.34)]}),
 item('seating',6,'beach-lounger-south','Teak beach lounger · south',176,224,{group:'beach',facing:'south',feet:[foot(.18,.53,.64,.43)]}),
 item('seating',7,'beach-lounger-west','Teak beach lounger · west',256,176,{group:'beach',facing:'west',feet:[foot(.16,.62,.68,.34)]})
]);
