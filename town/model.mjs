export const SCALE=4,W=9600,H=7200,HOME_FRIENDSHIP=5;
export const START={x:4400,y:4240};
export const HOME={width:640,depth:560,wall:16,backWall:64};
export function homeGeometry(x,y){return {x,y,w:HOME.width,h:HOME.depth,interior:{width:HOME.width,depth:HOME.depth},door:{x:x+HOME.width/2,y:y+HOME.depth+12}};}
export const residents=[
 ['bach','Bach',420,330,'#586d8d','Organ loft','A quiet study above the orchard.'],
 ['mozart','Mozart',625,285,'#ad6276','Rose cottage','A playful garden of roses and little surprises.'],
 ['beethoven','Beethoven',840,260,'#7b7889','Stormwatch','A stone house overlooking the northern falls.'],
 ['clara','Clara Schumann',1070,320,'#638c82','Fern house','A piano room beside the woodland stream.'],
 ['chopin','Chopin',340,620,'#8275a5','Willow retreat','A shaded terrace, a piano, and a view of the river.'],
 ['haydn','Haydn',560,570,'#b68b56','Sunflower house','The warmest kitchen in the orchard quarter.'],
 ['handel','Handel',780,560,'#7a90a4','Laurel hall','A formal garden opening onto the old square.'],
 ['vivaldi','Vivaldi',1040,590,'#bc7055','Four Seasons','Four small gardens, each with its own season.'],
 ['joplin','Scott Joplin',1530,450,'#be8d58','Maple porch','Ragtime drifts over a long riverside porch.'],
 ['ellington','Duke Ellington',1780,490,'#657da0','Bluebird villa','A blue roof and a garden made for company.'],
 ['ella','Ella Fitzgerald',2010,640,'#af7392','Honeysuckle','A bright cottage with a flowering courtyard.'],
 ['nina','Nina Simone',1650,760,'#688b77','Cedar sanctuary','A peaceful piano room beneath tall cedars.'],
 ['miles','Miles Davis',1990,940,'#657c91','River bend','A secluded studio where the river turns south.'],
 ['dj','DJ Coda',1630,1120,'#8c70ad','Nightjar studio','A record room at the edge of the lantern grove.'],
 ['vee-jay','Vee Jay',1910,1230,'#5c9c9a','Prism cottage','A colorful workshop overlooking the reed beds.'],
 ['zizi','Zizi',995,1320,'#c38170','Wildflower home','A tiny gate opens into a riot of flowers.'],
 ['metronome','Metronome',750,1430,'#a28c60','Clockmaker’s nook','An orderly little home with a very punctual garden.'],
 ['schoenberg','Schoenberg',380,1170,'#757e98','Twelve-tone lodge','An unusual garden tucked into the western woods.']
].map(([id,name,x,y,color,title,description],i)=>({id,name,color,title,description,style:i%6,...homeGeometry(x*SCALE,y*SCALE)}));
const landmarkLayout=[
 {id:'player',name:'Your cottage',title:'Your cottage',x:840,y:1130,w:95,h:76,color:'#b38c65',description:'Your own quiet place in Coda Town, with space for music and a garden.',kind:'player'},
 {name:'Coda Arcade',x:1060,y:890,w:125,h:105,color:'#597c98',description:'The music, games, and friends you know. Head back inside whenever you like.',kind:'arcade'},
 {name:'The bandstand',x:950,y:820,w:92,h:60,color:'#a27d62',description:'An open-air stage at the heart of town. A good place to meet again.',kind:'bandstand'},
 {name:'The glasshouse',x:560,y:1070,w:110,h:76,color:'#79a59a',description:'Herbs and climbing vines fill this old community greenhouse.',kind:'glasshouse'},
 {name:'Old lookout',x:1910,y:230,w:66,h:78,color:'#89918a',description:'Beyond the pines, the whole valley unfolds beneath you.',kind:'lookout'},
 {name:'The wishing tree',x:450,y:1520,w:0,h:0,description:'Ribbons rustle in the branches. Take a moment to listen.',kind:'tree'},
 {name:'Lily pond',x:450,y:920,w:0,h:0,description:'Dragonflies skim the lilies. The path continues around the water.',kind:'pond'},
 {name:'Moonwater shore',x:1500,y:1620,w:0,h:0,description:'A little boardwalk reaches into the quiet southern water.',kind:'shore'}
];
export const landmarks=landmarkLayout.map((l,i)=>l.kind==='player'?{...l,...homeGeometry(l.x*SCALE,l.y*SCALE),style:4}:{...l,x:l.x*SCALE,y:l.y*SCALE,w:l.w*SCALE,h:l.h*SCALE,style:i%6});
const arcade=landmarks.find(l=>l.kind==='arcade');Object.assign(arcade,{x:3700,y:3170,w:960,h:640});
Object.assign(landmarks.find(l=>l.kind==='bandstand'),{x:3450,y:4070,w:320,h:200});
export const districts=[['Orchard Heights',650,180],['Willow Quarter',550,760],['Coda Commons',1080,1110],['Bluebird Bank',1780,360],['Lantern Grove',1770,1390],['Wildflower Fields',820,1610],['Moonwater',1540,1730]].map(([name,x,y])=>[name,x*SCALE,y*SCALE]);
export const paths=[[[200,820],[600,820],[960,950],[1250,1000],[1500,920],[1800,860],[2190,880]],[[340,1450],[560,1200],[600,820],[650,450],[900,380],[1100,430]],[[960,950],[1000,1230],[1110,1440],[1500,1560],[1830,1450],[2070,1350]],[[1500,1560],[1470,1190],[1500,920],[1540,700],[1740,650],[1850,420],[1970,330]]].map(p=>p.map(([x,y])=>[x*SCALE,y*SCALE]));
export const riverX=y=>SCALE*(1295+Math.sin(y/SCALE/240)*58+Math.sin(y/SCALE/91)*17);
export const bridges=[{x:riverX(4000),y:4000},{x:riverX(1800),y:1800},{x:riverX(6040),y:6040}];
export function water(x,y){return Math.abs(x-riverX(y))<172 || ((x-1820)/464)**2+((y-3660)/296)**2<1 || y>6640+Math.sin(x/600)*120&&x>4800;}
export function solid(x,y){if(x<128||y<128||x>W-128||y>H-128)return true;if(water(x,y)&&!bridges.some(b=>Math.abs(x-b.x)<340&&Math.abs(y-b.y)<88)&&!(x>5740&&x<6260&&y>6320&&y<6840))return true;return [...residents,...landmarks.filter(l=>l.w)].some(h=>x>h.x-12&&x<h.x+h.w+12&&y>h.y&&y<h.y+h.h+8);}
export function roomPlan(home){const w=home.interior.width,h=home.interior.depth;return [
 {id:'bathroom',name:'Bathroom',x:16,y:64,w:w/2-66,h:210,material:'tile'},
 {id:'bedroom',name:'Bedroom',x:w/2+60,y:64,w:w/2-76,h:210,material:'wood'},
 {id:'entry',name:'Entry hall',x:w/2-50,y:64,w:100,h:h-80,material:'wood'},
 {id:'kitchen',name:'Kitchen & dining',x:16,y:282,w:w/2-66,h:h-298,material:'tile'},
 {id:'living',name:'Living & music',x:w/2+60,y:282,w:w/2-76,h:h-298,material:'wood'}];}
export function interiorWalls(home){const mid=home.interior.width/2;return [
 {x:mid-62,y:64,w:8,h:76},{x:mid-62,y:202,w:8,h:80},
 {x:mid+54,y:64,w:8,h:76},{x:mid+54,y:202,w:8,h:80},
 {x:16,y:274,w:mid-70,h:8},{x:mid+62,y:274,w:mid-78,h:8}];}
export function interiorFurniture(home){const w=home.interior.width;return [
 {kind:'shower',x:30,y:82,w:110,h:125},
 {kind:'toilet',x:185,y:91,w:40,h:65},
 {kind:'vanity',x:168,y:200,w:72,h:56},
 {kind:'bed',x:w-142,y:83,w:105,h:138},
 {kind:'wardrobe',x:w-234,y:83,w:59,h:68},
 {kind:'desk',x:w-234,y:205,w:76,h:47},
 {kind:'counter',x:28,y:288,w:160,h:76},
 {kind:'stove',x:204,y:298,w:42,h:65},
 {kind:'fridge',x:30,y:392,w:46,h:78},
 {kind:'dining',x:116,y:422,w:122,h:82},
 {kind:'piano',x:w-169,y:290,w:128,h:85},
 {kind:'sofa',x:w-224,y:394,w:152,h:58},
 {kind:'coffee',x:w-195,y:483,w:88,h:32}];}
export function atInteriorExit(x,y,home){return Math.abs(x-home.w/2)<38&&y>home.h-46;}
export function interiorSolid(x,y,home){const w=home.interior.width,h=home.interior.depth;return x<HOME.wall+10||x>w-HOME.wall-10||y<HOME.backWall+12||y>h-HOME.wall || [...interiorWalls(home),...interiorFurniture(home)].some(r=>x>r.x-9&&x<r.x+r.w+9&&y>r.y-4&&y<r.y+r.h+7);}
export function friendship(people,id){const value=people.find(p=>p.id===id)?.relationship?.count;return Number.isInteger(value)&&value>=0?value:0;}
export function canEnter(people,id){return friendship(people,id)>=HOME_FRIENDSHIP;}
export function nearest(x,y){return [...residents.map(h=>({...h,kind:'home',tx:h.door.x,ty:h.door.y})),...landmarks.map(l=>({...l,tx:l.x+l.w/2,ty:l.y+l.h+12}))].map(h=>({...h,distance:Math.hypot(x-h.tx,y-h.ty)})).sort((a,b)=>a.distance-b.distance)[0];}
