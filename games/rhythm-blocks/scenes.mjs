/**
 * Orthographic room artwork, foot-level collision and interaction bounds share
 * art pixels. People are reusable foreground actors, never baked into a room.
 */
import {DEPOT_ROOM} from './room.mjs';
import {ROOM_CONTENT} from './chapter-content.mjs';

const freeze=value=>{
 for(const item of Object.values(value))if(item&&typeof item==='object'&&!Object.isFrozen(item))freeze(item);
 return Object.freeze(value);
};
const rect=(x,y,width,height)=>({x,y,width,height});
const object=(id,type,label,bounds,extra={})=>({id,type,label,rect:bounds,...extra});
const inspect=(id,label,bounds)=>object(id,'inspect',label,bounds,{actionLabel:`Inspect ${label.toLowerCase()}`});
const door=(id,label,x,bottom=250)=>object(id,'door',label,rect(x-85,45,170,bottom-45),{doorId:id,actionLabel:`Choose ${label}`});

export const PARTY_ACTORS=freeze([
 {id:'nell',character:'nell',feet:{x:470,y:650},worldSize:160},
 {id:'iris',character:'iris',feet:{x:790,y:550},worldSize:160},
 {id:'pip',character:'pip',feet:{x:1090,y:680},worldSize:160}
]);
const oren={id:'oren',character:'oren',feet:{x:1010,y:430},worldSize:160};
const actorTarget=actor=>({id:actor.id,type:'person',label:`Talk to ${actor.id[0].toUpperCase()+actor.id.slice(1)}`,x:actor.feet.x,y:actor.feet.y,approach:{x:actor.feet.x,y:actor.feet.y+65},range:100});
const actorObstacle=actor=>({id:actor.id,x:actor.feet.x-35,y:actor.feet.y-26,width:70,height:26});
const actorObject=(actor,sourceId)=>object(actor.id,'person',actor.id[0].toUpperCase()+actor.id.slice(1),rect(actor.feet.x-64,actor.feet.y-160,128,166),{personId:actor.id,actionLabel:`Talk to ${actor.id[0].toUpperCase()+actor.id.slice(1)}`,...(sourceId?{sourceId}:{})});
const chests={
 'depot-chest':{rect:rect(265,435,125,100),x:330,y:527,base:rect(270,500,115,27)},
 'canal-chest':{rect:rect(210,425,130,100),x:274,y:520,base:rect(215,490,120,30)}
};
const chestObject=(id,label)=>object(id,'chest',label,chests[id].rect,{sourceId:id,actionLabel:id==='depot-chest'?'Open the delivery chest':'Open the stamped chest'});
const chestTarget=id=>({id,type:'chest',x:chests[id].x,y:chests[id].y,approach:{x:chests[id].x,y:chests[id].y+65},range:100});
const chestObstacle=id=>({id,...chests[id].base});

const depotObjects=[
 door('garden','Garden',490),door('workshop','Workshop',884),door('canal','Canal',1286),
 chestObject('depot-chest','Open'),
 inspect('returned-letter','Returned letter',rect(240,235,95,55)),
 inspect('clockwork-roost','Clockwork roost',rect(605,65,100,175)),
 inspect('dispatch-map','Dispatch map',rect(995,65,120,175)),
 inspect('route-orrery','Route orrery',rect(55,625,225,265)),
 inspect('star-post','Star post',rect(1290,590,195,300)),
 ...PARTY_ACTORS.map(actor=>actorObject(actor,actor.id==='nell'?'nell-parcel':null))
];

const porchSpecs=[
 {
  id:'garden-porch',title:'Iris’s Garden Porch',wall:295,gift:{person:'iris',source:'iris-gift'},
  forward:'The Listening Gate',dead:'The Overgrown Arch',
  props:[
   {id:'garden-porch-second-cup',label:'The second cup',placement:'right'},
   {id:'garden-porch-graft',label:'The patient graft',placement:'left'},
   {id:'garden-porch-old-plaque',label:'The reused survey plaque',placement:'wall'}
  ]
 },
 {
  id:'workshop-porch',title:'Pip’s Bird Workshop',wall:290,gift:{person:'pip',source:'pip-gift'},
  forward:'The Running Gate',dead:'The Silent Aviary',
  props:[
   {id:'workshop-porch-flight-jig',label:'The practice wing',placement:'left'},
   {id:'workshop-porch-seed-bowl',label:'The unnecessary seed bowl',placement:'right'},
   {id:'workshop-porch-return-feather',label:'The unmatched feather',placement:'wall'}
  ]
 },
 {
  id:'canal-porch',title:'The Canal Storehouse',wall:265,chest:true,
  forward:'The Delivery Gate',dead:'The Empty Ferry',
  props:[
   {id:'canal-porch-seal-line',label:'The drying seals',placement:'wall'},
   {id:'canal-porch-loading-console',label:'The secondhand navigator',placement:'left'},
   {id:'canal-porch-mooring-bell',label:'The small mooring bell',placement:'right'}
  ]
 }
];
const placements={
 'garden-porch':{
  wall:{rect:rect(1220,145,255,155),target:{x:1350,y:295,approach:{x:1350,y:355},range:100}},
  left:{rect:rect(45,690,250,240),target:{x:170,y:915,approach:{x:340,y:915},range:185}},
  right:{rect:rect(1215,765,235,155),target:{x:1300,y:900,approach:{x:1155,y:900},range:165}}
 },
 'workshop-porch':{
  wall:{rect:rect(1285,65,180,260),target:{x:1375,y:320,approach:{x:1375,y:380},range:100}},
  left:{rect:rect(60,655,190,230),target:{x:165,y:875,approach:{x:330,y:875},range:180}},
  right:{rect:rect(1265,645,220,240),target:{x:1365,y:865,approach:{x:1190,y:865},range:190}}
 },
 'canal-porch':{
  wall:{rect:rect(1295,100,205,105),target:{x:1400,y:300,approach:{x:1245,y:355},range:180}},
  left:{rect:rect(20,670,240,240),target:{x:155,y:895,approach:{x:330,y:895},range:190}},
  right:{rect:rect(1280,665,235,245),target:{x:1400,y:895,approach:{x:1190,y:895},range:225}}
 }
};
const porchBases={
 'garden-porch':[
  {id:'graft-planter',x:85,y:870,width:190,height:50},
  {id:'cup-table',x:1250,y:870,width:95,height:30},
  {id:'empty-chair',x:1350,y:880,width:85,height:32}
 ],
 'workshop-porch':[
  {id:'flight-jig',x:90,y:835,width:145,height:45},
  {id:'seed-workbench',x:1275,y:830,width:180,height:45},
  {id:'drafting-board',x:75,y:315,width:150,height:50},
  {id:'feather-cabinet',x:1295,y:290,width:160,height:30}
 ],
 'canal-porch':[
  {id:'navigator-base',x:75,y:860,width:175,height:40},
  {id:'mooring-bell-base',x:1310,y:855,width:185,height:45},
  {id:'upper-loading-desk',x:48,y:265,width:168,height:35},
  {id:'upper-freight-stack',x:1345,y:265,width:143,height:35}
 ]
};

// Foreground contours are read from the room art; furniture holes remain open.
const furnitureOccluders=freeze({
 "depot": [
  {
   "id": "depot-chest",
   "depth": 529,
   "clipPath": "path(evenodd,'M276.5 443.0 L292.0 442.5 L295.0 447.5 L358.0 447.5 L362.0 442.5 L380.0 444.5 L380.5 450.0 L384.5 452.0 L384.5 521.0 L381.5 525.0 L274.0 526.5 L268.5 520.0 L268.5 453.0 L273.5 450.0 L273.5 445.0Z')"
  },
  {
   "id": "kettle-cart",
   "depth": 552,
   "clipPath": "path(evenodd,'M71.5 440.0 L80.5 441.0 L73.5 443.0 L74.0 448.5 L94.5 448.0 L94.0 442.5 L85.0 442.5 L85.0 439.5 L104.0 441.5 L112.5 449.0 L113.5 470.0 L110.5 473.0 L114.0 474.5 L117.0 468.5 L125.0 468.5 L129.5 473.0 L129.5 479.0 L124.5 481.0 L122.5 491.0 L116.5 495.0 L118.0 497.5 L126.0 497.5 L131.5 504.0 L131.5 520.0 L127.0 526.5 L121.5 528.0 L121.5 550.0 L118.0 552.5 L106.0 552.5 L103.5 550.0 L103.5 539.0 L100.0 536.5 L88.0 537.5 L82.0 543.5 L74.0 543.5 L67.0 537.5 L66.5 548.0 L63.0 552.5 L51.0 553.5 L47.5 550.0 L45.0 520.5 L47.0 522.5 L57.0 520.5 L79.0 541.5 L105.0 510.5 L106.5 513.0 L101.5 517.0 L100.0 522.5 L120.0 522.5 L126.5 518.0 L127.5 504.0 L123.0 500.5 L113.0 500.5 L111.0 505.5 L103.0 508.5 L67.0 508.5 L58.0 505.5 L55.0 500.5 L44.5 501.0 L45.0 497.5 L52.5 497.0 L54.5 482.0 L45.5 471.0 L46.5 462.0 L49.0 458.5 L55.5 458.0 L55.5 450.0 L60.0 444.5Z')"
  },
  {
   "id": "route-orrery",
   "depth": 887,
   "clipPath": "path(evenodd,'M165.5 636.0 L177.0 635.5 L185.0 644.5 L203.0 646.5 L227.0 658.5 L241.5 676.0 L244.5 685.0 L260.0 693.5 L269.5 705.0 L270.5 716.0 L267.5 727.0 L255.5 738.0 L255.5 743.0 L250.5 747.0 L257.5 778.0 L249.5 783.0 L248.0 789.5 L240.5 791.0 L242.5 795.0 L241.5 812.0 L237.5 816.0 L237.5 822.0 L240.5 829.0 L240.5 842.0 L244.0 844.5 L247.0 825.5 L259.0 818.5 L264.0 810.5 L271.0 810.5 L276.5 815.0 L276.0 827.5 L256.0 824.5 L248.5 830.0 L249.5 840.0 L257.5 842.0 L249.5 843.0 L251.0 851.5 L266.5 851.0 L266.5 845.0 L259.5 843.0 L266.5 842.0 L267.5 833.0 L268.0 854.5 L272.5 854.0 L271.5 836.0 L273.5 833.0 L276.5 845.0 L273.5 850.0 L276.5 853.0 L276.5 864.0 L272.0 857.5 L263.0 858.5 L261.0 855.5 L253.0 855.5 L250.0 864.5 L247.5 856.0 L248.0 866.5 L264.0 862.5 L266.5 864.0 L250.5 869.0 L254.0 877.5 L257.0 876.5 L258.0 879.5 L266.0 877.5 L275.0 879.5 L276.0 877.5 L276.0 883.5 L256.0 883.5 L254.0 880.5 L249.0 880.5 L247.0 870.5 L235.0 879.5 L229.0 879.5 L228.0 882.5 L133.0 883.5 L128.0 879.5 L111.0 878.5 L110.0 875.5 L100.0 872.5 L96.0 866.5 L95.5 876.0 L92.0 879.5 L54.5 878.0 L55.0 872.5 L75.0 872.5 L76.5 866.0 L76.0 863.5 L65.5 862.0 L75.5 860.0 L75.5 848.0 L54.5 843.0 L88.0 842.5 L90.0 830.5 L92.5 837.0 L93.5 815.0 L90.0 810.5 L76.0 810.5 L75.0 814.5 L87.5 816.0 L84.0 829.5 L55.0 829.5 L55.0 819.5 L56.0 822.5 L60.0 819.5 L62.0 822.5 L73.0 825.5 L74.5 819.0 L68.5 811.0 L73.5 807.0 L69.0 803.5 L58.0 803.5 L54.5 806.0 L54.5 799.0 L61.5 792.0 L61.5 789.0 L54.5 785.0 L62.0 784.5 L64.5 788.0 L63.0 800.5 L68.0 799.5 L77.0 807.5 L92.0 807.5 L95.5 811.0 L98.5 815.0 L98.5 842.0 L101.0 842.5 L102.5 827.0 L105.5 822.0 L105.5 815.0 L101.5 812.0 L101.5 792.0 L104.5 788.0 L123.0 778.5 L145.0 790.5 L149.5 779.0 L128.0 757.5 L117.0 752.5 L111.5 751.0 L119.0 769.5 L100.0 764.5 L75.5 748.0 L71.5 743.0 L72.5 732.0 L79.5 723.0 L82.5 703.0 L88.5 691.0 L105.5 673.0 L105.5 668.0 L115.0 656.5 L124.0 655.5 L129.0 658.5 L150.0 647.5 L157.0 647.5 L158.5 642.0Z M136.0 665.5 L110.5 675.0 L102.5 703.0 L110.0 711.5 L126.5 692.0Z M200.0 667.5 L213.5 699.0 L227.0 705.5 L221.5 683.0Z M220.0 732.5 L206.5 751.0 L187.0 786.5 L194.0 785.5 L216.5 768.0 L226.5 740.0Z M265.5 867.0 L271.5 868.0 L267.0 869.5Z M271.5 870.0 L275.5 870.0 L276.0 875.5Z')"
  },
  {
   "id": "orrery-parcels",
   "depth": 887,
   "clipPath": "path(evenodd,'M263.5 811.0 L271.0 810.5 L276.0 814.5 L291.0 811.5 L296.0 815.5 L308.0 815.5 L311.5 819.0 L312.0 832.5 L323.0 832.5 L327.0 838.5 L337.0 841.5 L339.5 844.0 L339.5 855.0 L336.5 857.0 L338.5 881.0 L325.0 883.5 L309.0 880.5 L256.0 883.5 L254.0 880.5 L249.0 880.5 L247.5 871.0 L242.5 872.0 L244.5 830.0 L254.0 819.5 L259.0 818.5Z')"
  },
  {
   "id": "star-post",
   "depth": 887,
   "clipPath": "path(evenodd,'M1404.5 642.0 L1409.5 644.0 L1407.5 652.0 L1411.0 655.5 L1428.0 655.5 L1431.5 653.0 L1431.5 644.0 L1436.0 642.5 L1436.5 654.0 L1429.5 662.0 L1435.0 663.5 L1444.5 673.0 L1446.5 681.0 L1461.5 696.0 L1461.5 737.0 L1465.5 746.0 L1465.5 764.0 L1462.5 766.0 L1462.0 771.5 L1467.0 767.5 L1473.5 769.0 L1473.5 762.0 L1479.5 752.0 L1477.5 762.0 L1479.5 774.0 L1470.0 771.5 L1460.5 778.0 L1465.5 781.0 L1460.5 791.0 L1462.0 796.5 L1473.0 794.5 L1479.5 789.0 L1479.5 800.0 L1473.0 797.5 L1463.5 807.0 L1464.0 814.5 L1476.5 813.0 L1469.5 820.0 L1469.5 830.0 L1471.5 836.0 L1474.5 837.0 L1474.5 845.0 L1479.5 851.0 L1479.5 865.0 L1469.0 861.5 L1461.5 867.0 L1457.5 877.0 L1470.0 877.5 L1478.0 871.5 L1479.5 876.0 L1472.0 880.5 L1455.0 880.5 L1456.0 872.5 L1441.0 872.5 L1430.0 875.5 L1427.0 879.5 L1419.0 878.5 L1410.0 883.5 L1384.0 883.5 L1378.0 880.5 L1326.0 882.5 L1313.0 879.5 L1306.5 873.0 L1306.5 861.0 L1304.0 860.5 L1300.5 878.0 L1290.0 878.5 L1290.0 872.5 L1297.5 872.0 L1297.5 860.0 L1289.5 858.0 L1300.0 857.5 L1301.5 850.0 L1297.0 838.5 L1293.5 839.0 L1295.5 849.0 L1289.5 849.0 L1289.5 834.0 L1300.0 835.5 L1301.5 833.0 L1298.5 826.0 L1294.5 824.0 L1297.5 820.0 L1290.0 818.5 L1289.5 815.0 L1299.0 814.5 L1301.5 819.0 L1301.5 828.0 L1304.5 829.0 L1302.5 843.0 L1307.0 851.5 L1312.5 847.0 L1313.5 838.0 L1313.5 809.0 L1306.5 804.0 L1306.5 797.0 L1300.0 795.5 L1296.5 790.0 L1295.5 762.0 L1308.5 746.0 L1307.5 736.0 L1297.5 726.0 L1297.5 700.0 L1303.5 695.0 L1309.5 677.0 L1321.0 666.5 L1330.0 661.5 L1335.0 662.5 L1337.0 658.5 L1362.0 658.5 L1368.0 651.5 L1391.0 651.5 L1397.5 657.0 L1400.0 664.5 L1409.0 664.5 L1410.5 661.0 L1403.5 655.0Z')"
  },
  {
   "id": "clipping-tray",
   "depth": 887,
   "clipPath": "path(evenodd,'M1306.5 799.0 L1309.5 799.0 L1309.0 805.5Z M1280.5 802.0 L1288.5 804.0 L1290.0 814.5 L1299.0 814.5 L1301.5 819.0 L1301.5 828.0 L1304.5 829.0 L1302.5 843.0 L1306.5 851.0 L1309.5 851.0 L1309.0 875.5 L1306.5 873.0 L1306.5 861.0 L1304.0 860.5 L1300.0 878.5 L1222.0 878.5 L1218.5 874.0 L1218.5 866.0 L1214.0 855.5 L1204.5 860.0 L1214.5 866.0 L1214.5 874.0 L1211.0 877.5 L1208.0 876.5 L1203.0 880.5 L1185.5 879.0 L1189.5 866.0 L1198.5 860.0 L1183.0 857.5 L1181.5 851.0 L1197.0 838.5 L1205.0 838.5 L1214.0 844.5 L1214.5 820.0 L1219.0 815.5 L1256.0 815.5 L1260.0 807.5 L1271.0 811.5Z')"
  },
  {
   "id": "counter",
   "depth": 376,
   "clipPath": "path(evenodd,'M88 248 L96 240 L114 236 L128 242 L139 250 L238 250 L241 236 L265 234 L283 239 L313 239 L322 246 L334 250 L339 261 L337 285 L330 300 L333 364 L323 376 L88 376 L78 367 L81 302 L75 290 L75 260Z')"
  },
  {
   "id": "wall-parcels",
   "depth": 276,
   "clipPath": "path(evenodd,'M1400 186 L1429 185 L1436 194 L1451 195 L1453 220 L1468 220 L1470 232 L1490 234 L1491 268 L1480 276 L1425 275 L1414 267 L1389 267 L1384 258 L1390 235 L1391 204Z')"
  }
 ],
 "garden-porch": [
  {
   "id": "graft-planter",
   "depth": 923,
   "clipPath": "path(evenodd,'M193.5 690.0 L200.0 691.5 L202.0 696.5 L209.0 695.5 L213.0 698.5 L217.5 704.0 L217.5 712.0 L207.5 712.0 L207.0 723.5 L200.0 723.5 L188.0 716.5 L182.5 723.0 L187.0 727.5 L193.0 726.5 L195.0 729.5 L204.0 729.5 L211.0 733.5 L218.0 727.5 L230.0 727.5 L237.5 737.0 L237.5 745.0 L226.0 744.5 L228.5 753.0 L234.0 754.5 L238.0 749.5 L247.0 748.5 L253.0 750.5 L260.5 760.0 L260.5 769.0 L251.5 770.0 L250.5 782.0 L246.5 784.0 L250.5 794.0 L250.5 806.0 L244.0 806.5 L239.0 803.5 L234.5 816.0 L236.0 818.5 L240.0 815.5 L251.0 815.5 L251.5 819.0 L258.5 824.0 L258.5 830.0 L254.5 832.0 L261.0 833.5 L266.5 841.0 L266.5 851.0 L261.5 852.0 L263.5 853.0 L263.5 867.0 L260.5 871.0 L264.0 874.5 L272.0 869.5 L284.0 871.5 L284.5 878.0 L290.5 885.0 L290.5 893.0 L276.0 892.5 L274.0 900.5 L262.0 897.5 L261.5 904.0 L254.0 910.5 L229.0 917.5 L153.0 917.5 L129.0 911.5 L121.0 902.5 L114.5 905.0 L113.0 913.5 L104.0 912.5 L99.0 917.5 L94.0 917.5 L88.0 906.5 L72.0 910.5 L69.5 908.0 L69.5 900.0 L75.5 888.0 L61.5 887.0 L65.5 870.0 L72.5 867.0 L70.5 862.0 L64.5 858.0 L67.5 842.0 L73.0 840.5 L73.5 835.0 L80.0 832.5 L82.0 828.5 L88.5 829.0 L89.5 823.0 L85.5 822.0 L85.5 814.0 L91.0 809.5 L100.5 809.0 L99.5 801.0 L104.0 795.5 L110.5 794.0 L110.5 782.0 L114.5 778.0 L113.5 772.0 L118.0 768.5 L132.0 769.5 L132.5 764.0 L142.0 761.5 L145.5 754.0 L138.5 746.0 L138.0 741.5 L132.0 744.5 L118.5 745.0 L118.5 734.0 L122.5 723.0 L129.0 720.5 L130.0 717.5 L142.0 717.5 L144.0 713.5 L149.0 713.5 L150.5 706.0 L158.5 700.0 L161.0 694.5 L171.0 694.5 L178.5 701.0 L180.0 706.5 L183.0 705.5 L185.5 695.0Z M79.5 729.0 L89.0 730.5 L89.5 736.0 L98.5 740.0 L98.5 745.0 L101.5 746.0 L99.5 757.0 L104.5 762.0 L104.5 769.0 L102.0 772.5 L94.5 774.0 L97.5 777.0 L96.0 788.5 L86.0 787.5 L82.0 794.5 L74.0 794.5 L69.5 787.0 L69.0 778.5 L56.5 780.0 L56.5 771.0 L61.5 761.0 L55.0 760.5 L53.5 754.0 L58.0 747.5 L65.5 745.0 L67.0 739.5 L73.0 738.5 L73.5 734.0Z')"
  },
  {
   "id": "cup-table",
   "depth": 903,
   "clipPath": "path(evenodd,'M1353.5 770.0 L1356.5 770.0 L1356.0 784.5 L1351.5 783.0Z M1274.5 771.0 L1283.0 777.5 L1288.0 777.5 L1291.0 783.5 L1294.0 783.5 L1294.5 780.0 L1304.0 772.5 L1324.0 774.5 L1328.0 779.5 L1336.5 782.0 L1336.5 790.0 L1342.0 792.5 L1348.5 802.0 L1348.5 819.0 L1345.5 825.0 L1333.5 832.0 L1330.0 843.5 L1311.5 854.0 L1312.0 856.5 L1322.0 854.5 L1324.0 859.5 L1336.0 860.5 L1336.5 865.0 L1343.5 872.0 L1343.5 880.0 L1329.0 880.5 L1328.5 885.0 L1321.0 885.5 L1320.5 893.0 L1310.0 899.5 L1267.0 899.5 L1257.5 893.0 L1257.0 887.5 L1243.0 890.5 L1239.5 887.0 L1239.0 879.5 L1224.5 880.0 L1224.5 871.0 L1233.0 859.5 L1247.0 859.5 L1250.0 862.5 L1252.0 854.5 L1261.0 854.5 L1266.5 862.0 L1264.0 863.5 L1263.5 860.0 L1257.0 856.5 L1253.5 860.0 L1253.5 866.0 L1261.0 865.5 L1265.0 868.5 L1268.5 865.0 L1265.5 853.0 L1252.0 847.5 L1244.5 839.0 L1243.5 832.0 L1235.0 827.5 L1227.5 819.0 L1227.5 803.0 L1233.0 794.5 L1248.5 786.0 L1249.5 777.0 L1253.0 773.5Z M1354.5 839.0 L1356.5 839.0 L1356.5 851.0 L1352.5 851.0 L1352.5 863.0 L1356.5 866.0 L1353.5 895.0 L1356.0 903.5 L1350.5 899.0 L1351.5 867.0 L1348.5 864.0 L1348.5 850.0 L1353.5 845.0Z')"
  },
  {
   "id": "empty-chair",
   "depth": 915,
   "clipPath": "path(evenodd,'M1353.5 770.0 L1356.5 770.0 L1355.5 781.0 L1358.0 781.5 L1364.0 777.5 L1368.0 778.5 L1372.5 774.0 L1369.0 769.5 L1374.0 769.5 L1376.0 772.5 L1380.0 769.5 L1407.0 769.5 L1409.0 771.5 L1422.0 769.5 L1419.5 776.0 L1426.0 782.5 L1431.0 775.5 L1439.0 779.5 L1439.0 771.5 L1448.5 771.0 L1449.5 781.0 L1444.0 785.5 L1436.0 782.5 L1430.5 789.0 L1431.5 795.0 L1435.5 797.0 L1440.0 806.5 L1445.5 794.0 L1449.5 797.0 L1443.0 809.5 L1438.0 809.5 L1431.5 804.0 L1430.0 873.5 L1432.5 872.0 L1431.5 866.0 L1435.5 857.0 L1443.0 854.5 L1443.5 850.0 L1449.5 845.0 L1448.5 850.0 L1445.5 851.0 L1445.5 858.0 L1438.0 858.5 L1434.5 865.0 L1435.0 871.5 L1443.5 871.0 L1441.5 880.0 L1446.5 881.0 L1445.5 884.0 L1449.5 890.0 L1438.0 886.5 L1432.5 892.0 L1437.0 905.5 L1449.5 897.0 L1449.5 902.0 L1442.0 908.5 L1435.0 908.5 L1431.0 897.5 L1426.0 901.5 L1419.0 901.5 L1413.5 897.0 L1413.0 890.5 L1404.5 895.0 L1404.5 907.0 L1399.0 910.5 L1388.5 908.0 L1387.0 893.5 L1377.0 894.5 L1374.0 890.5 L1367.5 891.0 L1367.5 899.0 L1363.0 903.5 L1351.5 901.0 L1351.5 867.0 L1348.5 864.0 L1348.5 850.0 L1353.5 845.0 L1354.5 839.0 L1362.5 834.0 L1361.5 793.0 L1365.5 784.0 L1364.0 780.5 L1356.0 784.5 L1351.5 783.0Z M1400.0 790.5 L1399.5 820.0 L1411.0 822.5 L1412.5 794.0Z M1392.0 791.5 L1379.5 799.0 L1383.0 821.5 L1394.5 819.0Z M1339.5 793.0 L1342.0 792.5 L1348.5 802.0 L1348.5 819.0 L1340.0 828.5 L1339.5 824.0 L1344.5 819.0 L1345.5 804.0Z M1339.5 868.0 L1343.5 872.0 L1343.5 880.0 L1341.0 881.5Z')"
  }
 ],
 "workshop-porch": [
  {
   "id": "flight-jig",
   "depth": 883,
   "clipPath": "path(evenodd,'M160.5 665.0 L175.0 665.5 L177.5 669.0 L177.5 680.0 L193.0 689.5 L197.5 699.0 L190.0 702.5 L183.0 695.5 L176.0 693.5 L172.0 699.5 L164.0 699.5 L158.0 694.5 L127.0 699.5 L113.5 712.0 L121.5 722.0 L122.0 728.5 L157.0 728.5 L169.0 736.5 L170.5 733.0 L167.5 729.0 L167.5 722.0 L169.5 717.0 L178.0 710.5 L187.0 710.5 L193.5 716.0 L202.0 730.5 L238.0 727.5 L242.5 733.0 L235.5 749.0 L223.0 761.5 L207.0 767.5 L194.0 764.5 L187.5 767.0 L189.0 769.5 L202.0 770.5 L205.5 777.0 L202.5 789.0 L223.0 794.5 L232.5 803.0 L234.5 810.0 L233.5 829.0 L230.5 832.0 L234.5 863.0 L220.0 873.5 L188.0 881.5 L137.0 880.5 L117.0 876.5 L94.0 864.5 L91.0 867.5 L86.0 865.5 L79.5 860.0 L79.0 855.5 L70.0 856.5 L66.5 854.0 L67.5 844.0 L64.5 843.0 L65.5 836.0 L72.5 831.0 L63.5 818.0 L66.5 811.0 L78.0 802.5 L89.5 806.0 L87.5 792.0 L91.0 786.5 L95.5 785.0 L98.5 777.0 L98.5 758.0 L85.0 757.5 L79.5 753.0 L76.5 741.0 L77.5 731.0 L81.0 727.5 L91.5 726.0 L99.5 702.0 L119.0 680.5 L138.0 670.5 L159.0 667.5Z M111.0 765.5 L110.5 783.0 L120.0 791.5 L132.0 789.5 L123.5 776.0Z M159.0 775.5 L156.5 794.0 L169.0 793.5 L169.5 779.0Z')"
  },
  {
   "id": "seed-workbench",
   "depth": 879,
   "clipPath": "path(evenodd,'M1368.5 689.0 L1373.0 688.5 L1377.5 692.0 L1382.0 712.5 L1386.5 712.0 L1386.5 706.0 L1393.0 693.5 L1401.5 695.0 L1403.5 703.0 L1397.5 715.0 L1402.5 721.0 L1401.5 738.0 L1407.0 739.5 L1421.5 738.0 L1417.5 732.0 L1421.5 712.0 L1415.5 709.0 L1416.5 694.0 L1422.5 694.0 L1418.5 699.0 L1419.5 707.0 L1424.0 709.5 L1442.0 708.5 L1444.5 698.0 L1442.0 695.5 L1439.0 698.5 L1434.5 698.0 L1442.0 692.5 L1447.5 696.0 L1448.5 707.0 L1442.5 712.0 L1445.5 732.0 L1441.5 736.0 L1444.5 739.0 L1445.5 748.0 L1453.0 749.5 L1456.5 754.0 L1456.5 806.0 L1458.0 808.5 L1468.0 803.5 L1470.0 808.5 L1479.5 812.0 L1482.5 820.0 L1473.5 830.0 L1482.5 838.0 L1481.5 853.0 L1472.0 855.5 L1471.5 858.0 L1475.5 859.0 L1468.0 864.5 L1463.0 864.5 L1459.0 869.5 L1452.0 869.5 L1447.0 873.5 L1428.0 874.5 L1420.0 869.5 L1341.0 869.5 L1282.0 873.5 L1278.5 871.0 L1281.5 831.0 L1278.5 827.0 L1278.5 817.0 L1270.5 812.0 L1270.5 755.0 L1277.0 748.5 L1293.0 748.5 L1298.0 739.5 L1318.0 732.5 L1338.0 734.5 L1349.0 739.5 L1355.0 749.5 L1364.0 749.5 L1365.5 732.0 L1363.5 721.0 L1369.5 713.0 L1363.5 701.0 L1363.5 692.0Z')"
  },
  {
   "id": "drafting-board",
   "depth": 365,
   "clipPath": "path(evenodd,'M111 196 L126 199 L131 211 L207 215 L220 222 L221 242 L239 234 L250 239 L249 254 L255 267 L254 310 L240 318 L219 318 L219 342 L207 350 L167 348 L158 361 L139 365 L117 360 L112 350 L115 342 L80 345 L76 337 L78 307 L73 304 L73 228 L83 220 L111 217Z')"
  },
  {
   "id": "feather-cabinet",
   "depth": 321,
   "clipPath": "path(evenodd,'M1357 70 L1384 70 L1395 81 L1401 89 L1416 93 L1432 105 L1441 122 L1446 144 L1446 220 L1453 225 L1453 269 L1444 278 L1444 311 L1432 321 L1310 321 L1297 313 L1295 281 L1291 276 L1291 252 L1301 244 L1306 231 L1305 143 L1310 122 L1318 106 L1334 96 L1354 91Z')"
  }
 ],
 "canal-porch": [
  {
   "id": "canal-chest",
   "depth": 523,
   "clipPath": "path(evenodd,'M218.5 428.0 L239.0 427.5 L242.0 431.5 L305.0 431.5 L308.0 427.5 L327.0 427.5 L332.5 443.0 L333.5 518.0 L329.0 520.5 L214.0 519.5 L213.5 443.0Z')"
  },
  {
   "id": "navigator-base",
   "depth": 904,
   "clipPath": "path(evenodd,'M19.5 670.0 L21.5 670.0 L21.0 908.5Z M97.5 671.0 L106.0 673.5 L116.5 685.0 L119.5 713.0 L111.5 719.0 L112.0 722.5 L131.0 720.5 L131.5 712.0 L144.0 704.5 L176.0 704.5 L186.5 712.0 L188.0 720.5 L205.0 721.5 L206.5 728.0 L212.0 729.5 L221.5 738.0 L222.5 752.0 L230.5 757.0 L230.5 763.0 L237.5 768.0 L235.5 807.0 L241.5 811.0 L241.5 821.0 L237.5 825.0 L234.5 846.0 L236.0 850.5 L247.0 850.5 L250.5 854.0 L250.0 896.5 L231.0 896.5 L229.0 900.5 L132.0 900.5 L131.0 903.5 L93.0 903.5 L88.0 902.5 L86.0 898.5 L55.0 900.5 L37.5 894.0 L37.5 885.0 L46.5 872.0 L55.5 851.0 L51.0 846.5 L47.0 849.5 L35.0 849.5 L33.5 847.0 L34.5 838.0 L37.5 836.0 L35.5 833.0 L39.5 828.0 L32.0 827.5 L31.5 821.0 L43.5 809.0 L35.5 807.0 L35.5 803.0 L28.5 799.0 L28.5 793.0 L36.0 789.5 L38.0 785.5 L45.5 784.0 L42.5 775.0 L45.0 768.5 L51.0 767.5 L58.0 772.5 L64.0 770.5 L66.5 773.0 L69.5 738.0 L77.0 732.5 L82.0 733.5 L83.5 727.0 L89.5 722.0 L89.5 719.0 L80.5 713.0 L83.5 685.0Z')"
  },
  {
   "id": "mooring-bell",
   "depth": 903,
   "clipPath": "path(evenodd,'M1513.5 665.0 L1514.0 908.5 L1513.0 847.5 L1502.0 851.5 L1502.0 854.5 L1495.0 852.5 L1491.0 861.5 L1484.5 860.0 L1484.5 865.0 L1490.0 873.5 L1493.0 867.5 L1502.0 871.5 L1502.5 865.0 L1506.5 864.0 L1506.0 875.5 L1492.5 876.0 L1492.5 898.0 L1490.0 900.5 L1450.0 900.5 L1449.0 903.5 L1417.0 904.5 L1356.0 903.5 L1353.0 900.5 L1313.0 900.5 L1309.5 898.0 L1309.0 892.5 L1282.5 891.0 L1284.5 879.0 L1289.5 871.0 L1279.5 869.0 L1279.5 857.0 L1284.5 853.0 L1281.5 850.0 L1281.5 843.0 L1296.0 841.5 L1297.5 834.0 L1295.5 832.0 L1298.0 827.5 L1308.5 830.0 L1308.5 814.0 L1317.5 810.0 L1317.5 797.0 L1323.5 792.0 L1323.5 753.0 L1318.5 750.0 L1318.5 736.0 L1323.5 732.0 L1324.5 725.0 L1329.5 722.0 L1335.5 709.0 L1342.5 703.0 L1345.0 694.5 L1355.0 688.5 L1366.0 689.5 L1374.0 684.5 L1386.0 683.5 L1389.5 675.0 L1397.0 670.5 L1405.0 670.5 L1416.0 684.5 L1424.0 684.5 L1433.0 689.5 L1445.0 688.5 L1455.5 697.0 L1455.5 703.0 L1464.5 711.0 L1468.5 721.0 L1474.5 726.0 L1475.5 732.0 L1480.5 736.0 L1480.5 750.0 L1474.5 755.0 L1475.5 781.0 L1491.0 776.5 L1494.5 778.0 L1494.5 789.0 L1500.5 791.0 L1500.5 796.0 L1493.5 802.0 L1494.5 809.0 L1489.5 812.0 L1492.5 823.0 L1505.0 820.5 L1507.5 823.0 L1504.5 833.0 L1513.0 839.5Z M1364.0 699.5 L1342.5 717.0 L1336.5 740.0 L1336.0 779.5 L1344.0 781.5 L1351.5 772.0 L1358.5 758.0 L1365.5 724.0 L1384.5 704.0Z M1418.0 705.5 L1433.5 737.0 L1435.5 765.0 L1447.0 780.5 L1459.0 783.5 L1460.5 747.0 L1453.5 729.0 L1433.0 710.5Z M1340.0 786.5 L1341.0 806.5 L1360.0 812.5 L1388.5 803.0 L1384.0 788.5Z M1457.0 789.5 L1420.0 790.5 L1417.5 805.0 L1430.0 813.5 L1457.0 805.5Z M1502.5 855.0 L1506.5 859.0 L1505.0 862.5 L1498.5 859.0Z')"
  },
  {
   "id": "upper-loading-desk",
   "depth": 301,
   "clipPath": "path(evenodd,'M77 204 L92 210 L118 209 L132 223 L153 231 L161 250 L179 258 L210 258 L217 268 L213 292 L202 298 L177 298 L163 291 L158 299 L79 301 L62 290 L50 299 L27 297 L23 287 L26 254 L39 248 L61 249 L60 222Z')"
  },
  {
   "id": "upper-freight-stack",
   "depth": 301,
   "clipPath": "path(evenodd,'M1459 191 L1494 189 L1505 197 L1505 226 L1511 232 L1511 289 L1498 300 L1388 300 L1375 290 L1350 289 L1337 280 L1337 256 L1344 247 L1370 247 L1375 230 L1384 220 L1396 211 L1412 205 L1439 210 L1454 218 L1458 226Z')"
  }
 ]
});

function porch(spec){
 const actors=[...PARTY_ACTORS,...(spec.chest?[oren]:[])];
 const forwardId=`${spec.id}-forward`,deadId=`${spec.id}-dead`;
 const objects=[
  door(forwardId,spec.forward,490,spec.wall),door(deadId,spec.dead,1045,spec.wall),
  ...actors.map(actor=>actorObject(actor,spec.gift?.person===actor.id?spec.gift.source:null)),
  ...(spec.chest?[chestObject('canal-chest','Stamped chest')]:[]),
  ...spec.props.map(prop=>inspect(prop.id,prop.label,placements[spec.id][prop.placement].rect)),
  object('return-depot','return','Revisit the depot',rect(680,920,176,90),{actionLabel:'Revisit the depot'})
 ];
 const targets=[
  {id:forwardId,type:'door',x:490,y:spec.wall,approach:{x:490,y:spec.wall+60},range:100},
  {id:deadId,type:'door',x:1045,y:spec.wall,approach:{x:1045,y:spec.wall+60},range:100},
  ...actors.map(actorTarget),
  ...(spec.chest?[chestTarget('canal-chest')]:[]),
  ...spec.props.map(prop=>({id:prop.id,type:'inspect',label:`Inspect ${prop.label.toLowerCase()}`,...placements[spec.id][prop.placement].target})),
  {id:'return-depot',type:'return',label:'Revisit the depot',x:768,y:960,approach:{x:768,y:910},range:85}
 ];
 const obstacles=[
  ...actors.map(actorObstacle),
  ...porchBases[spec.id],
  ...(spec.chest?[chestObstacle('canal-chest')]:[])
 ];
 return {
  id:spec.id,title:spec.title,image:`assets/${spec.id}.webp`,actors,
  geometry:{
   width:1536,height:1024,gridSize:32,radius:18,speed:260,maxDeltaMs:50,
   bounds:{x:48,y:spec.wall,width:1440,height:978-spec.wall},start:{x:768,y:920,facing:'up'},
   obstacles,targets
  },
  objects,occluders:furnitureOccluders[spec.id]
 };
}

export const SCENES=freeze(Object.fromEntries([
 ['depot',{id:'depot',title:'The Parcel Depot',image:'assets/parcel-depot.webp',geometry:DEPOT_ROOM,actors:PARTY_ACTORS,objects:depotObjects,occluders:furnitureOccluders.depot}],
 ...porchSpecs.map(spec=>[spec.id,porch(spec)])
].map(([id,scene])=>{
 const entries=new Map((ROOM_CONTENT[id]?.inspections??[]).map(entry=>[entry.id,entry]));
 const action=id=>entries.get(id).label??`Inspect ${entries.get(id).title.toLowerCase()}`;
 return [id,{...scene,objects:scene.objects.map(item=>entries.has(item.id)?{...item,label:entries.get(item.id).title,actionLabel:action(item.id)}:item),geometry:scene.geometry===DEPOT_ROOM?DEPOT_ROOM:{...scene.geometry,targets:scene.geometry.targets.map(item=>entries.has(item.id)?{...item,label:action(item.id)}:item)}}];
})));

/** Unknown save/route ids never silently select a different room. */
export function getScene(id){return typeof id==='string'&&Object.hasOwn(SCENES,id)?SCENES[id]:null;}
