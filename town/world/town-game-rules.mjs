import {createPlayerCollisionIndex} from './player-collision-index.mjs?v=town-flight-1';
import {blocked,height,cell,COLS,ROWS} from './model.mjs?v=town-flight-1';
export const NOTE_VALUES=Object.freeze(['quarter','eighth-pair','sixteenth-group']);
export const CATCH_PATTERNS=Object.freeze([
 ['quarter','eighth-pair','sixteenth-group','quarter'],
 ['eighth-pair','quarter','eighth-pair','sixteenth-group'],
 ['sixteenth-group','quarter','eighth-pair','quarter'],
 ['quarter','sixteenth-group','quarter','eighth-pair'],
 ['eighth-pair','quarter','eighth-pair','quarter'],
 ['quarter','sixteenth-group','eighth-pair','sixteenth-group']
].map(Object.freeze));
export function catchAttacks(value){return value==='quarter'?[0]:value==='eighth-pair'?[0,.5]:value==='sixteenth-group'?[0,.25,.5,.75]:[];}
export const sameRhythm=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
export function remainingNotes(target,bag){const left=[...target];for(const n of bag){const i=left.indexOf(n);if(i>=0)left.splice(i,1);}return left;}
export function reachableNoteSpots(doc,catalog,origin,{limit=COLS*ROWS,radius=22000,clearance=0}={}){
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0});
 const offsets=clearance>0?[[0,0],[clearance,0],[-clearance,0],[0,clearance],[0,-clearance]]:[[0,0]];
 const clear=p=>p.x>32&&p.y>32&&p.x<COLS*64-32&&p.y<ROWS*64-32&&Math.hypot(p.x-origin.x,p.y-origin.y)<=radius&&offsets.every(([dx,dy])=>{const q={x:p.x+dx,y:p.y+dy};return !blocked(index.view(q),q.x,q.y,catalog);});
 const linked=(a,b)=>{const ca=cell(doc,Math.floor(a.x/64),Math.floor(a.y/64)),cb=cell(doc,Math.floor(b.x/64),Math.floor(b.y/64)),step=ca.stairs||cb.stairs||ca.curves||cb.curves?2:8;const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/step));let prev=a;for(let i=1;i<=steps;i++){const q={x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps};if(!clear(q)||offsets.some(([dx,dy])=>Math.abs(height(doc,q.x+dx,q.y+dy)-height(doc,prev.x+dx,prev.y+dy))>14))return false;prev=q;}return true;};
 let start;for(let r=0;r<=3&&!start;r++)for(let yy=-r;yy<=r&&!start;yy++)for(let xx=-r;xx<=r;xx++){const p={x:(Math.floor(origin.x/64)+xx)*64+32,y:(Math.floor(origin.y/64)+yy)*64+32};if(clear(p)&&linked(origin,{x:p.x,y:origin.y})&&linked({x:p.x,y:origin.y},p)){start=p;break;}}
 if(!start)return [];
 const key=p=>`${p.x},${p.y}`,queue=[start],seen=new Set([key(start)]);
 for(let i=0;i<queue.length&&queue.length<limit;i++)for(const [dx,dy]of [[64,0],[-64,0],[0,64],[0,-64]]){
  const a=queue[i],p={x:a.x+dx,y:a.y+dy},k=key(p);if(seen.has(k))continue;seen.add(k);if(clear(p)&&linked(a,p))queue.push(p);
 }
 return queue.filter(p=>Math.hypot(p.x-origin.x,p.y-origin.y)>220);
}
export function scatterNotes(target,spots,random=Math.random){
 const values=[...target,...Array.from({length:92},(_,i)=>NOTE_VALUES[i%NOTE_VALUES.length])],pool=spots.map(p=>({...p,rank:random()})).sort((a,b)=>a.rank-b.rank),placed=[];
 for(const [i,value]of values.entries()){
  const at=pool.find(p=>placed.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>160));if(!at)break;
  pool.splice(pool.indexOf(at),1);placed.push({id:`note-${i}`,value,x:at.x,y:at.y,phase:random()*Math.PI*2});
 }
 return placed.length>=target.length?placed:[];
}
export function findFishingDock(doc,catalog){
 const apartment=doc.objects.find(o=>o.asset==='coda-residences');
 const cells=Object.entries(doc.cells||{}).filter(([,v])=>v.pier).map(([key,v])=>{const [x,y]=key.split(',').map(Number);return {x:x*64+32,y:y*64+32,level:v.pier.level};});
 if(!cells.length)return null;
 const near=apartment||doc.spawn||cells[0];cells.sort((a,b)=>Math.hypot(a.x-near.x,a.y-near.y)-Math.hypot(b.x-near.x,b.y-near.y));
 const first=cells[0],pool=new Map(cells.map(p=>[`${p.x},${p.y}`,p])),group=[first],seen=new Set([`${first.x},${first.y}`]);
 for(const p of group)for(const [dx,dy]of [[64,0],[-64,0],[0,64],[0,-64]]){const k=`${p.x+dx},${p.y+dy}`,q=pool.get(k);if(q&&!seen.has(k)){seen.add(k);group.push(q);}}
 group.sort((a,b)=>Math.hypot(b.x-near.x,b.y-near.y)-Math.hypot(a.x-near.x,a.y-near.y));
 const tip=group[0],candidate=doc.objects.filter(o=>['decor-11-01','decor-11-02','decor-11-03'].includes(o.asset)).sort((a,b)=>Math.hypot(a.x-tip.x,a.y-tip.y)-Math.hypot(b.x-tip.x,b.y-tip.y))[0];
 const boat=candidate&&Math.hypot(candidate.x-tip.x,candidate.y-tip.y)<1500?candidate:{x:tip.x+(tip.x<near.x?-100:100),y:tip.y+55,virtual:true};
 const stand=group.filter(p=>!blocked(doc,p.x,p.y,catalog)).sort((a,b)=>Math.hypot(a.x-boat.x,a.y-boat.y)-Math.hypot(b.x-boat.x,b.y-boat.y))[0];
 return stand?{stand,boat,level:tip.level}:null;
}
const RAW_FISH=[
 ['copper-sprat','Copper Sprat','common','slender'],['harbour-goby','Harbour Goby','common','round'],['sunstripe-perch','Sunstripe Perch','common','striped'],['tidal-dace','Tidal Dace','common','slender'],['bluefin-smelt','Bluefin Smelt','common','slender'],['pebble-flounder','Pebble Flounder','common','deep'],
 ['ripple-mackerel','Ripple Mackerel','uncommon','striped'],['rosefin-mullet','Rosefin Mullet','uncommon','broad'],['sea-glass-wrasse','Sea-glass Wrasse','uncommon','round'],['dotted-drumfish','Dotted Drumfish','uncommon','spotted'],['ribbon-pipefish','Ribbon Pipefish','uncommon','long'],['moonlit-herring','Moonlit Herring','uncommon','slender'],
 ['syncopation-snapper','Syncopation Snapper','rare','deep'],['triplet-trout','Triplet Trout','rare','spotted'],['coral-cadence','Coral Cadence','rare','spiny'],['polka-puffer','Polka Puffer','rare','round'],['sapphire-seahorse','Sapphire Seahorse','rare','seahorse'],['swingtail-bass','Swingtail Bass','rare','broad'],
 ['aurora-sailfish','Aurora Sailfish','epic','sail'],['velvet-manta','Velvet Manta','epic','manta'],['silver-sonata','Silver Sonata','epic','slender'],['tempo-tigerfish','Tempo Tigerfish','epic','striped'],['golden-fermata','Golden Fermata','legendary','deep'],['constellation-koi','Constellation Koi','legendary','spotted']
];
export const FISH_MODES=Object.freeze([{id:'echo',name:'Echo the fish',tip:'Listen, then tap the rhythm back.'},{id:'current',name:'Beat current',tip:'Tap as each note reaches the gold line.'},{id:'hold',name:'Reel & hold',tip:'Tap short notes. Hold long notes until their tails pass.'},{id:'response',name:'Call & response',tip:'The fish plays a bar; answer it. Two calls, two replies.'}]);
export const TOWN_FISH=Object.freeze(RAW_FISH.map(([id,name,rarity,shape],i)=>Object.freeze({id,name,rarity,shape,rank:['common','uncommon','rare','epic','legendary'].indexOf(rarity),meter:['4/4','3/4','6/8','2/2'][i%4],color:['#78d7cb','#e5ae74','#a5a2f2','#ef92b3','#8dc2ee','#d6da87'][i%6],accent:'#f7e5af',size:[12+i*2,30+i*4],index:i})));
export function fishingPattern(fish){
 const bar=['3/4','6/8'].includes(fish.meter)?3:4;
 const pools=bar===3?[[1,1,1],[1,.5,.5,1],[1.5,.5,1],[.5,.5,2],[.5,1,.5,1]]:[[1,1,1,1],[1,.5,.5,2],[.5,.5,1,1,1],[2,1,.5,.5],[.5,1,.5,1,1]];
 return {values:[...pools[(fish.index||0)%pools.length]],bar,bpm:fish.meter==='6/8'?108:fish.meter==='2/2'?116:80+fish.rank*4};
}
export function createFishingChallenge(fish,mode='current',{start=0}={}){
 if(!FISH_MODES.some(m=>m.id===mode))throw Error('Unknown fishing mode');
 const p=fishingPattern(fish),spb=60/p.bpm,countBeat=fish.meter==='6/8'?1.5:fish.meter==='2/2'?2:1,countPulses=fish.meter==='6/8'||fish.meter==='2/2'?2:p.bar,countEnd=start+countPulses*countBeat*spb,events=[],cues=[];
 const bars=mode==='response'?4:mode==='echo'?3:3;
 for(let bar=0;bar<bars;bar++){
  const listen=mode==='echo'?bar===0:mode==='response'?bar%2===0:false;
  let beat=0;for(const [i,value]of p.values.entries()){
   const event={id:`${bar}-${i}`,at:countEnd+(bar*p.bar+beat)*spb,duration:value*spb,hold:mode==='hold'&&value>=1,judgement:null};
   (listen?cues:events).push(event);beat+=value;
  }
 }
 return {fish,mode,...p,start,countEnd,countBeat,countPulses,spb,events,cues,end:countEnd+bars*p.bar*spb+.25,hits:0,misses:0,extras:0,held:null,feedback:'Listen to the count-in',finished:false};
}
export function updateFishingChallenge(s,now){
 if(s.finished)return;
 for(const e of s.events){if(e.judgement==='holding'&&s.held===e.id&&now>=e.at+e.duration*.82){e.judgement='hit';s.hits++;s.held=null;s.feedback='Great hold!';}else if(!e.judgement&&now>e.at+.2){e.judgement='miss';s.misses++;s.feedback='Keep the beat—you can still land it!';}}
 if(now>=s.end){s.finished=true;s.accuracy=Math.max(0,(s.hits-s.extras*.35)/s.events.length);s.caught=s.accuracy>=.65;}
}
export function fishingPress(s,now){
 updateFishingChallenge(s,now);if(s.finished||now<s.countEnd-.2)return 'wait';
 if(s.cues.some(c=>now>=c.at-.2&&now<c.at+c.duration)&&!s.events.some(e=>Math.abs(e.at-now)<=.2))return 'listen';
 const event=s.events.filter(e=>!e.judgement&&Math.abs(e.at-now)<=.2).sort((a,b)=>Math.abs(a.at-now)-Math.abs(b.at-now))[0];
 if(!event){s.extras++;s.feedback='Wait for the next beat';return 'extra';}
 if(event.hold){event.judgement='holding';s.held=event.id;s.feedback='Hold…';return 'hold';}
 event.judgement='hit';s.hits++;s.feedback=Math.abs(event.at-now)<.08?'Perfect!':'Nice catch!';return 'hit';
}
export function fishingRelease(s,now){
 updateFishingChallenge(s,now);if(!s.held)return;
 const event=s.events.find(e=>e.id===s.held);s.held=null;if(event?.judgement==='holding'){event.judgement='miss';s.misses++;s.feedback='Hold until the tail passes';}
}
