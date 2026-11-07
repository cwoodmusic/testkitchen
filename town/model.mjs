// All lengths use the arcade character renderer's native world pixels.
export const SCALE=1,W=16000,H=12000,HOME_FRIENDSHIP=5;
export const START={x:7000,y:7400};
export const HOME={width:880,depth:760,wall:24,backWall:92};
export const ARCHITECTURES={
 cottage:{label:'Moderate cottage',core:{x:0,y:0,w:880,h:760},annexes:[]},
 sidewing:{label:'L-shaped home',core:{x:0,y:0,w:960,h:800},annexes:[{id:'studio',name:'Music studio',x:960,y:300,w:560,h:500,join:'east'}]},
 rearwing:{label:'Home with rear library',core:{x:0,y:240,w:1040,h:800},annexes:[{id:'library',name:'Library',x:300,y:0,w:740,h:240,join:'north'}]},
 pavilion:{label:'Large three-wing home',core:{x:400,y:0,w:1120,h:880},annexes:[{id:'library',name:'Library',x:0,y:320,w:400,h:560,join:'west'},{id:'studio',name:'Music studio',x:1520,y:440,w:480,h:440,join:'east'}]},
 courtyard:{label:'Very large courtyard home',core:{x:500,y:0,w:1120,h:880},annexes:[{id:'wintergarden',name:'Winter garden & reading room',x:0,y:480,w:500,h:720,join:'west'},{id:'studio',name:'Music studio',x:1620,y:360,w:500,h:840,join:'east'}]}
};
export function homeGeometry(x,y,index=0,architecture='cottage'){
 const plan=ARCHITECTURES[architecture],core={...plan.core},annexes=plan.annexes.map(r=>({...r})),parts=[core,...annexes],width=Math.max(...parts.map(r=>r.x+r.w)),depth=Math.max(...parts.map(r=>r.y+r.h)),rise=[48,72,96,32][index%4],deckDepth=[180,220,240,160][index%4],courtyard=architecture==='courtyard';
 const porch={x:x+core.x+(courtyard?16:-32),y:y+core.y+core.h,w:core.w+(courtyard?-32:64),h:deckDepth,rise,material:index%3===0?'stone':'wood'};
 const stairs={x:x+core.x+core.w/2-96,y:porch.y+porch.h,w:192,h:192,axis:'y',from:rise,to:0};
 return {x,y,w:width,h:depth,architecture,architectureLabel:plan.label,core,annexes,parts,floorArea:parts.reduce((sum,p)=>sum+p.w*p.h,0),entry:{x:core.x+core.w/2,y:core.y+core.h-36},interior:{width,depth},porch,stairs,door:{x:x+core.x+core.w/2,y:y+core.y+core.h+36}};
}
export function insideFootprint(x,y,home){return home.parts.some(r=>inRect(x,y,r));}
export function entryConnectors(home){const c=home.core;return home.annexes.map(r=>r.join==='north'?{axis:'y',x:c.x+c.w/2-64,y:c.y-20,w:128,h:64*c.h/560+40}:r.join==='east'?{axis:'x',x:c.x+c.w-24,y:Math.max(c.y+c.h*.72,r.y+80)-64,w:48,h:128}:{axis:'x',x:c.x-24,y:Math.max(c.y+c.h*.72,r.y+80)-64,w:48,h:128});}
const homes=[
 ['bach','Bach',1100,900,'#586875','Organ loft',2400,0],
 ['mozart','Mozart',2700,900,'#8d6670','Rose cottage',2400,1],
 ['beethoven','Beethoven',4500,900,'#6f7180','Stormwatch',2400,2],
 ['clara','Clara Schumann',6450,850,'#658079','Fern house',2400,3],
 ['chopin','Chopin',1200,3850,'#77758b','Willow retreat',5600,2],
 ['haydn','Haydn',3000,4000,'#a38b64','Sunflower house',5600,4],
 ['handel','Handel',5000,3850,'#778995','Laurel hall',5600,0],
 ['vivaldi','Vivaldi',6800,4300,'#9d765e','Four Seasons',5600,1],
 ['joplin','Scott Joplin',11000,1700,'#a18865','Maple porch',3000,4],
 ['ellington','Duke Ellington',13000,1650,'#637487','Bluebird villa',3000,5],
 ['ella','Ella Fitzgerald',13200,4100,'#9a7889','Honeysuckle',5600,1],
 ['nina','Nina Simone',10700,4200,'#677c69','Cedar sanctuary',5600,3],
 ['miles','Miles Davis',13400,5700,'#667886','River bend',7200,5],
 ['dj','DJ Coda',11000,8700,'#786982','Nightjar studio',10400,2],
 ['vee-jay','Vee Jay',13200,8800,'#648887','Prism cottage',10400,3],
 ['zizi','Zizi',4500,10100,'#a27d70','Wildflower home',11400,4],
 ['metronome','Metronome',1900,10000,'#908466','Clockmaker’s nook',11400,0],
 ['schoenberg','Schoenberg',1300,7300,'#6e7787','Twelve-tone lodge',8800,5]
];
const plans=['cottage','sidewing','pavilion','rearwing','rearwing','cottage','sidewing','cottage','sidewing','courtyard','cottage','courtyard','rearwing','sidewing','rearwing','sidewing','cottage','cottage'];
export const residents=homes.map(([id,name,x,y,color,title,street,style],i)=>({id,name,color,title,style,street,description:title+' is '+name+'’s '+ARCHITECTURES[plans[i]].label.toLowerCase()+', with a private garden and raised porch.',...homeGeometry(x,y,i,plans[i])}));
export const landmarks=[
 {id:'player',name:'Your cottage',title:'Your cottage',kind:'player',style:4,color:'#9a8063',street:8800,description:'Your own home overlooking the sheltered garden terrace.',...homeGeometry(4300,7240,2,'rearwing')},
 {id:'arcade',name:'Coda Arcade',kind:'arcade',x:6400,y:6100,w:1200,h:900,style:0,description:'The heart of town. Return to the arcade and your current player.'},
 {id:'bandstand',name:'The bandstand',kind:'bandstand',x:6100,y:7660,w:500,h:340,style:3,description:'A sheltered stage beside the town square.'},
 {id:'glasshouse',name:'The glasshouse',kind:'glasshouse',x:2700,y:7100,w:800,h:620,style:3,description:'Herbs and seedlings grow on the protected garden terrace.'},
 {id:'lookout',name:'Old lookout',kind:'lookout',x:14780,y:6700,w:320,h:360,style:5,description:'The ridge looks down over the river and the lower town.'},
 {id:'tree',name:'The wishing tree',kind:'tree',x:1100,y:10300,w:0,h:0,description:'A venerable willow in a quiet woodland hollow.'},
 {id:'pond',name:'Lily pond',kind:'pond',x:1950,y:6100,w:0,h:0,description:'A still pool below the orchard embankment.'},
 {id:'shore',name:'Moonwater shore',kind:'shore',x:10200,y:11300,w:0,h:0,description:'Weathered steps descend to the cool southern water.'}
];
export const allHomes=[...residents,...landmarks.filter(l=>l.porch)];
export const terraces=[
 {id:'orchard',name:'Orchard Heights',x:800,y:500,w:6800,h:2800,height:96,tone:'orchard'},
 {id:'ridge',name:'Bluebird Ridge',x:10400,y:1600,w:4800,h:6000,height:64,tone:'ridge'},
 {id:'garden',name:'Willow Gardens',x:900,y:6600,w:4700,h:2600,height:64,tone:'garden'},
 {id:'lantern',name:'Lantern Terrace',x:10300,y:8500,w:4200,h:2100,height:64,tone:'lantern'}
];
export const landStairs=[
 {id:'orchard-south',x:3880,y:3160,w:240,h:480,axis:'y',from:96,to:0},
 {id:'orchard-east',x:7440,y:2880,w:480,h:240,axis:'x',from:96,to:0},
 {id:'ridge-north',x:10040,y:2880,w:480,h:240,axis:'x',from:0,to:64},
 {id:'ridge-west',x:10040,y:5480,w:480,h:240,axis:'x',from:0,to:64},
 {id:'ridge-south',x:12880,y:7440,w:240,h:480,axis:'y',from:64,to:0},
 {id:'garden-north',x:3880,y:6440,w:240,h:480,axis:'y',from:0,to:64},
 {id:'garden-south',x:3880,y:9040,w:240,h:480,axis:'y',from:64,to:0},
 {id:'lantern-north',x:12880,y:8340,w:240,h:480,axis:'y',from:0,to:64},
 {id:'lantern-west',x:10140,y:10280,w:480,h:240,axis:'x',from:0,to:64}
];
export const districts=[['Orchard Heights',4100,650],['Willow Quarter',3500,3700],['Coda Commons',7000,7850],['Bluebird Ridge',12500,1550],['Lantern Terrace',12400,8450],['Wildflower Fields',4200,11600],['Moonwater',10500,11620]];
export const paths=[
 [[1150,2400],[7500,2400]],[[4000,2400],[4000,11400]],
 [[4000,3000],[13000,3000]],[[900,5600],[14900,5600]],
 [[13000,3000],[13000,10400]],[[10800,7200],[14900,7200]],
 [[1300,8800],[5400,8800]],[[4000,9600],[7600,9600],[7600,10400],[14900,10400]],
 [[1000,11400],[7600,11400]],[[7000,5600],[7000,7600]]
];
export function accessPath(home){return [[home.door.x,home.stairs.y+home.stairs.h],[home.door.x,home.street]];}
export const riverX=y=>8500+Math.sin(y/1400)*140+Math.sin(y/440)*36;
export const bridges=[3000,5600,10400].map(y=>({x:riverX(y),y,w:960,h:240}));
export const inRect=(x,y,r,margin=0)=>x>=r.x-margin&&x<=r.x+r.w+margin&&y>=r.y-margin&&y<=r.y+r.h+margin;
export function water(x,y){return Math.abs(x-riverX(y))<210||((x-1950)/620)**2+((y-6100)/380)**2<1||y>11240+Math.sin(x/850)*90&&x>8200;}
export function stairHeight(s,x,y){const t=Math.max(0,Math.min(1,s.axis==='x'?(x-s.x)/s.w:(y-s.y)/s.h));return s.from+(s.to-s.from)*t;}
export function baseElevation(x,y){const stairs=landStairs.find(s=>inRect(x,y,s));if(stairs)return stairHeight(stairs,x,y);return terraces.find(t=>inRect(x,y,t))?.height||0;}
export function stairAt(x,y){const land=landStairs.find(s=>inRect(x,y,s));if(land)return land;return allHomes.map(h=>h.stairs).find(s=>inRect(x,y,s))||null;}
export function elevation(x,y){for(const h of allHomes){if(inRect(x,y,h.stairs))return baseElevation(h.door.x,h.porch.y)+stairHeight(h.stairs,x,y);if(inRect(x,y,h.porch))return baseElevation(h.door.x,h.porch.y)+h.porch.rise;}return baseElevation(x,y);}
export function solid(x,y){if(x<160||y<160||x>W-160||y>H-160)return true;if(water(x,y)&&!bridges.some(b=>inRect(x,y,{x:b.x-b.w/2,y:b.y-b.h/2,w:b.w,h:b.h})))return true;return trunkSolid(x,y)||[...residents,...landmarks.filter(l=>l.w)].some(h=>h.parts?insideFootprint(x-h.x,y-h.y,h):inRect(x,y,h));}
export function canStep(from,to){return !solid(to.x,to.y)&&Math.abs(elevation(to.x,to.y)-elevation(from.x,from.y))<=4.1;}
export function biomeAt(x,y){if(y>10800&&x>7800)return 'marsh';if(x<700||x>15100||y<500||x<2800&&y>9300)return 'forest';return terraces.find(t=>inRect(x,y,t))?.tone||(x<6000&&y>9500?'meadow':'lawn');}
const seed=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
export const groves=[
 {x:250,y:180,w:15100,h:480,type:1}, {x:15100,y:1100,w:650,h:9800,type:1},
 {x:220,y:1200,w:610,h:7800,type:0}, {x:600,y:9300,w:1000,h:1900,type:0},
 {x:9300,y:500,w:5600,h:800,type:1}, {x:7800,y:3500,w:400,h:1800,type:2},
 {x:9000,y:3500,w:950,h:1600,type:0}, {x:9000,y:7700,w:950,h:2400,type:1},
 {x:5900,y:9000,w:1200,h:800,type:0}, {x:800,y:5800,w:1500,h:550,type:2},
 {x:5700,y:2700,w:1400,h:700,type:0}
];
function segmentDistance(x,y,a,b){if(a[0]===b[0])return Math.hypot(x-a[0],Math.max(Math.min(a[1],b[1])-y,0,y-Math.max(a[1],b[1])));return Math.hypot(y-a[1],Math.max(Math.min(a[0],b[0])-x,0,x-Math.max(a[0],b[0])));}
export function nearRoad(x,y,margin=190){return [...paths,...allHomes.map(accessPath)].some(p=>p.slice(1).some((q,i)=>segmentDistance(x,y,p[i],q)<margin));}
const plantingClear=(x,y)=>!water(x,y)&&!nearRoad(x,y)&&!allHomes.some(h=>inRect(x,y,{x:h.x-150,y:h.y-150,w:h.w+300,h:h.h+h.porch.h+500}))&&!landmarks.some(h=>h.w&&inRect(x,y,h,150))&&!landStairs.some(s=>inRect(x,y,s,120));
export const townTrees=[];
for(const [gi,grove] of groves.entries())for(let y=grove.y+120;y<grove.y+grove.h;y+=290)for(let x=grove.x+100;x<grove.x+grove.w;x+=280){const px=x+(seed(x,y)-.5)*140,py=y+(seed(y,x)-.5)*140;if(plantingClear(px,py))townTrees.push({x:px,y:py,size:1+seed(x+4,y)*.45,type:grove.type,tone:gi%3===0?'forest':biomeAt(px,py),radius:30});}
for(const h of allHomes)for(const side of [-1,1]){const x=h.x+(side<0?-240:h.w+240),y=h.y+h.h-120;if(plantingClear(x,y))townTrees.push({x,y,size:1.05,type:h.style===4?4:h.style===2?1:0,tone:biomeAt(x,y),radius:30});}
for(let y=1100;y<2100;y+=280)for(let x=1900;x<2400;x+=280)if(plantingClear(x,y))townTrees.push({x,y,size:.85,type:4,tone:'orchard',radius:24});
townTrees.push({x:1100,y:10300,size:2,type:2,tone:'forest',radius:50});
const trunkGrid=new Map();for(const t of townTrees){const key=Math.floor(t.x/256)+','+Math.floor(t.y/256);if(!trunkGrid.has(key))trunkGrid.set(key,[]);trunkGrid.get(key).push(t);}
function trunkSolid(x,y){const gx=Math.floor(x/256),gy=Math.floor(y/256);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const t of trunkGrid.get((gx+dx)+','+(gy+dy))||[])if(Math.hypot(x-t.x,(y-t.y)*1.5)<t.radius)return true;return false;}
export function canTravel(from,to){const count=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/8));let p=from;for(let i=1;i<=count;i++){const q={x:from.x+(to.x-from.x)*i/count,y:from.y+(to.y-from.y)*i/count};if(!canStep(p,q))return false;p=q;}return true;}
function roomPlanBase(home){const w=home.interior.width,h=home.interior.depth;return [
 {id:'bathroom',name:'Bathroom',x:16,y:64,w:w/2-66,h:210,material:'tile'},
 {id:'bedroom',name:'Bedroom',x:w/2+60,y:64,w:w/2-76,h:210,material:'wood'},
 {id:'entry',name:'Entry hall',x:w/2-50,y:64,w:100,h:h-80,material:'wood'},
 {id:'kitchen',name:'Kitchen & dining',x:16,y:282,w:w/2-66,h:h-298,material:'tile'},
 {id:'living',name:'Living & music',x:w/2+60,y:282,w:w/2-76,h:h-298,material:'wood'}];}
function interiorWallsBase(home){const mid=home.interior.width/2;return [
 {x:mid-62,y:64,w:8,h:76},{x:mid-62,y:202,w:8,h:80},
 {x:mid+54,y:64,w:8,h:76},{x:mid+54,y:202,w:8,h:80},
 {x:16,y:274,w:mid-70,h:8},{x:mid+62,y:274,w:mid-78,h:8}];}
function interiorFurnitureBase(home){const w=home.interior.width;return [
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
const baseHome={w:640,h:560,interior:{width:640,depth:560}};
function scalePlan(items,home){const core=home.core||{x:0,y:0,w:home.w,h:home.h},sx=core.w/640,sy=core.h/560;return items.map(r=>({...r,x:core.x+r.x*sx,y:core.y+r.y*sy,w:r.w*sx,h:r.h*sy}));}
export const roomPlan=home=>[...scalePlan(roomPlanBase(baseHome),home),...(home.annexes||[]).map(r=>({...r,material:'wood'}))];
export function interiorWalls(home){const walls=scalePlan(interiorWallsBase(baseHome),home);for(const [i,r] of (home.annexes||[]).entries()){const door=entryConnectors(home)[i],c=home.core;if(r.join==='north'){walls.push({x:r.x,y:c.y,w:door.x-r.x,h:16},{x:door.x+door.w,y:c.y,w:r.x+r.w-door.x-door.w,h:16});}else{const x=r.join==='east'?c.x+c.w-8:c.x-8,start=Math.max(c.y,r.y),end=Math.min(c.y+c.h,r.y+r.h);walls.push({x,y:start,w:16,h:door.y-start},{x,y:door.y+door.h,w:16,h:end-door.y-door.h});}}return walls.filter(r=>r.w>0&&r.h>0);}

export function annexFurniture(home){return (home.annexes||[]).flatMap(r=>[{kind:'bookcase',x:r.x+24,y:r.y+24,w:r.w-48,h:30},...(r.join==='north'?[{kind:'desk',x:r.x+80,y:r.y+110,w:170,h:65},{kind:'sofa',x:r.x+r.w-260,y:r.y+110,w:200,h:80}]:[{kind:r.id==='studio'?'piano':'desk',x:r.x+70,y:r.y+75,w:Math.min(240,r.w-140),h:110},{kind:'sofa',x:r.x+70,y:r.y+r.h-150,w:Math.min(250,r.w-140),h:90}])]);}
export const interiorFurniture=home=>[...scalePlan(interiorFurnitureBase(baseHome),home),...annexFurniture(home)];
export function atInteriorExit(x,y,home){return Math.abs(x-home.entry.x)<home.core.w/640*38&&y>home.core.y+home.core.h-home.core.h/560*46&&y<home.core.y+home.core.h;}
export function interiorSolid(x,y,home){if(![[0,0],[14,0],[-14,0],[0,10],[0,-10]].every(([dx,dy])=>insideFootprint(x+dx,y+dy,home)))return true;const c=home.core,northBand=inRect(x,y,{x:c.x,y:c.y,w:c.w,h:64*c.h/560+10});if(northBand&&!entryConnectors(home).some(d=>d.axis==='y'&&inRect(x,y,d)))return true;return [...interiorWalls(home),...interiorFurniture(home)].some(r=>x>r.x-9&&x<r.x+r.w+9&&y>r.y-4&&y<r.y+r.h+7);}
export function friendship(people,id){const value=people.find(p=>p.id===id)?.relationship?.count;return Number.isInteger(value)&&value>=0?value:0;}
export function canEnter(people,id){return friendship(people,id)>=HOME_FRIENDSHIP;}
export function nearest(x,y){return [...residents.map(h=>({...h,kind:'home',tx:h.door.x,ty:h.door.y})),...landmarks.map(l=>({...l,tx:l.door?.x??l.x+l.w/2,ty:l.door?.y??l.y+l.h+12}))].map(h=>({...h,distance:Math.hypot(x-h.tx,y-h.ty)})).sort((a,b)=>a.distance-b.distance)[0];}
