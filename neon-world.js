// Coda Arcade: Neon Nights. No network calls; dialogue is prewritten and kid-friendly.
const neonPeople=[
 {name:'Ziggy',x:230,y:345,color:'#ffb46f',lines:["I've been here all day. Don't tell anyone!","That high score was almost mine.","I came for one game. That was three hours ago."]},
 {name:'Nova',x:415,y:395,color:'#9edcff',lines:["This couch is officially my favorite spot.","The lights in here are so cool.","I like the arcade best when it's busy."]},
 {name:'Byte',x:680,y:355,color:'#bda1ff',lines:["I almost beat my high score. Almost.","Do you think the vending machine takes pixels?","My controller skills are legendary. In theory."]},
 {name:'Mochi',x:800,y:450,color:'#ffa6c7',lines:["Do arcade machines dream?","I think that plant is judging me.","I've made a new friend. It's the snack machine."]},
 {name:'Pip',x:500,y:253,color:'#ffe28a',shop:true,lines:["Welcome to the Pixel Boutique!","Looking for a fresh look?"]}
];
const neonDancers=[{name:'Riff',x:320,y:380,color:'#e5a8ff'},{name:'Fizz',x:670,y:390,color:'#95e6e2'},{name:'Dot',x:505,y:460,color:'#ffd48c'}];
let neonChatCount=0;
function neonClosest(){const people=currentRoom==='lounge'?neonPeople:currentRoom==='dance'?neonDancers:currentRoom==='arcade'?[...neonPeople,...neonDancers]:[];return people.find(p=>{const a=npcScene(p);return a.room===currentRoom&&Math.hypot(pos.x-a.x,pos.y-a.y)<90})||null}
function neonPrompt(){const p=neonClosest();if(p)return p.shop?'E · Talk to Pip / Customize':'E · Talk to '+p.name;if(currentRoom==='lounge')return 'Explore the lounge';if(currentRoom==='dance')return 'Dance with Q';return ''}
function neonStatus(){const p=neonClosest();if(p)return 'Press E to talk to '+p.name;if(currentRoom==='lounge')return 'Social Lounge · Chat with visitors or visit Pip';if(currentRoom==='dance')return 'Dance Floor · Press Q to emote';return ''}
function neonInteract(){if(currentRoom==='arcade'){
 const visitor=[...neonPeople,...neonDancers].find(p=>{const a=npcScene(p);return a.room==='arcade'&&Math.hypot(pos.x-a.x,pos.y-a.y)<65});if(visitor){const line=visitor.lines?visitor.lines[neonChatCount++%visitor.lines.length]:'Nice moves!';show('<p class="eyebrow">ARCADE CHAT</p><h2>'+visitor.name+'</h2><p>'+line+'</p><button id="neonbye">See you around!</button>');$('neonbye').onclick=()=>modal.close();return true;}
 if(Math.hypot(pos.x-220,pos.y-705)<75){enterRoom('lounge');return true}
 if(Math.hypot(pos.x-650,pos.y-705)<70){enterRoom('dance');return true}
 return false;
 }
 if(currentRoom==='lounge'||currentRoom==='dance'){
 if(Math.hypot(pos.x-500,pos.y-555)<66){enterRoom('arcade');return true}
 const p=neonClosest();if(!p)return true;
 if(p.shop){show('<p class="eyebrow">THE PIXEL BOUTIQUE</p><h2>Pip ✦ Shopkeeper</h2><p>Hey there! Welcome to the Pixel Boutique. Looking for a new look?</p><button id="neonshop">Show me what you’ve got!</button> <button id="neonbye">Just looking!</button>');$('neonshop').onclick=()=>{modal.close();wardrobe()};$('neonbye').onclick=()=>modal.close();return true}
 const line=p.lines? p.lines[neonChatCount++%p.lines.length] : 'Great moves! The floor is yours!';show('<p class="eyebrow">ARCADE CHAT</p><h2>'+p.name+'</h2><p>'+line+'</p><button id="neonbye">See you around!</button>');$('neonbye').onclick=()=>modal.close();return true;
 }return false}
function neonClick(x,y){if(currentRoom==='arcade'){
 if(Math.hypot(x-220,y-705)<65){enterRoom('lounge');return true}
 if(Math.hypot(x-650,y-705)<65){enterRoom('dance');return true}
 return false;
 }if(currentRoom==='lounge'||currentRoom==='dance'){
 if(y>535&&Math.abs(x-500)<95){enterRoom('arcade');return true}
 const p=(currentRoom==='lounge'?neonPeople:neonDancers).find(p=>Math.hypot(x-npcScene(p).x,y-npcScene(p).y)<60&&npcScene(p).room===currentRoom);
 if(p){target={x:npcScene(p).x,y:Math.min(565,npcScene(p).y+57)};return true}
 target={x:Math.max(70,Math.min(930,x)),y:Math.max(155,Math.min(565,y))};return true;
 }return false}
function neonFloor(name){rect(0,0,1000,800,'#12152b');for(let y=88;y<605;y+=32)for(let x=35;x<965;x+=32){rect(x,y,31,31,((x+y)/32)%2?'#242440':'#2c2a4a');rect(x,y,31,1,'#40375d')}rect(18,15,964,75,'#49395f');rect(20,16,960,6,'#e79cda');rect(18,90,18,515,'#5d4b73');rect(964,90,18,515,'#5d4b73');rect(18,605,18,160,'#5d4b73');rect(964,605,18,160,'#5d4b73');for(let y=605;y<770;y+=32)for(let x=35;x<965;x+=32){rect(x,y,31,31,'#242440');rect(x,y,31,1,'#40375d')}rect(18,765,964,18,'#8b6d98');text(name,500,61,26,'#f6b9ea')}
// NPCs use the SAME pixel avatar renderer as the player, including showcase unlockables.
const npcLooks={
 Ziggy:{skin:'#d49a76',hair:'#171424',shirt:'#ffb46f',hairstyle:'spiky',outfit:'shorts',shoes:'gold',accessory:'partyglasses',walked:0},
 Nova:{skin:'#704633',hair:'#d4e2f8',shirt:'#69e0ff',hairstyle:'long',outfit:'dress',shoes:'neon',accessory:'starclip',walked:0},
 Byte:{skin:'#f4ccb0',hair:'#463145',shirt:'#bda1ff',hairstyle:'curly',outfit:'overalls',shoes:'hightops',accessory:'headphones',walked:0},
 Mochi:{skin:'#a56b48',hair:'#f3d875',shirt:'#ffa6c7',hairstyle:'buns',outfit:'pants',shoes:'boots',accessory:'bow',walked:0},
 Pip:{skin:'#d49a76',hair:'#463145',shirt:'#ffe28a',hairstyle:'bob',outfit:'overalls',shoes:'gold',accessory:'bowtie',walked:0},
 Riff:{skin:'#704633',hair:'#171424',shirt:'#e5a8ff',hairstyle:'ponytail',outfit:'dress',shoes:'neon',accessory:'cape',walked:0},
 Fizz:{skin:'#f4ccb0',hair:'#f3d875',shirt:'#95e6e2',hairstyle:'spiky',outfit:'shorts',shoes:'gold',accessory:'cap',walked:0},
 Dot:{skin:'#a56b48',hair:'#d4e2f8',shirt:'#ffd48c',hairstyle:'curly',outfit:'overalls',shoes:'neon',accessory:'starclip',walked:0}
};
const npcBase={};for(const p of [...neonPeople,...neonDancers])npcBase[p.name]={x:p.x,y:p.y};
// Editable NPC schedules. Each visitor enters from the main exit, visits a cabinet,
// then a lounge seat or dance spot, and finally leaves through the same exit.
// Schedules are staggered so the room does not empty or fill all at once.
const npcCabinets=[205,395,605,795];
const npcSeats=[{x:165,y:348},{x:830,y:348},{x:170,y:355},{x:824,y:355}];
const npcDanceSpots=[{x:290,y:350},{x:450,y:425},{x:610,y:345},{x:750,y:430}];
const npcDialogue=[
  'This place is pretty cool!', 'I could stay here all day.',
  'Did you see that?', 'What a night!', 'I love this place.',
  'Haha, seriously?', 'No way!', 'See you around!'
];
function npcLerp(a,b,t){return a+(b-a)*Math.max(0,Math.min(1,t))}
function npcScene(p){
 if(p.shop)return {room:'lounge',x:500,y:253,emote:false,activity:'shop'};
 const n=[...neonPeople,...neonDancers].findIndex(v=>v.name===p.name);
 const duration=96, t=((animationTime/1000+n*17)%duration+duration)%duration;
 const cabinet=npcCabinets[n%4], seat=npcSeats[n%4], dance=npcDanceSpots[n%4];
 const visitingDance=neonDancers.includes(p)||n%3===0;
 const activityRoom=visitingDance?'dance':'lounge';
 const point=(room,x,y,activity,emote=false)=>({room,x,y,activity,emote});
 // Main exit is (500,705); cabinet visitors stop below the cabinet controls.
 if(t<9)return point('arcade',npcLerp(500,cabinet,t/9),npcLerp(735,290,t/9),'arriving');
 if(t<29)return point('arcade',cabinet+Math.sin(t*.4+n)*3,290,'playing');
 if(t<37)return point('arcade',npcLerp(cabinet,visitingDance?650:220,(t-29)/8),npcLerp(290,705,(t-29)/8),'walking');
 // Cross-room travel: disappear at the arcade doorway, appear at the room entrance.
 if(t<44){const q=(t-37)/7;return point(activityRoom,npcLerp(500,visitingDance?dance.x:seat.x,q),npcLerp(535,visitingDance?dance.y:seat.y,q),'walking');}
 if(t<70){
  if(visitingDance)return point('dance',dance.x+Math.sin(t*.9+n)*7,dance.y+Math.cos(t*.8+n)*4,'dancing',true);
  return point('lounge',seat.x,seat.y+8,'sitting');
 }
 if(t<77){const q=(t-70)/7;return point(activityRoom,npcLerp(visitingDance?dance.x:seat.x,500,q),npcLerp(visitingDance?dance.y:seat.y+8,535,q),'walking');}
 if(t<84)return point('arcade',npcLerp(visitingDance?650:220,500,(t-77)/7),npcLerp(705,645,(t-77)/7),'walking');
 return point('arcade',500,npcLerp(645,755,(t-84)/12),'leaving');
}
function npcSpeech(p,scene){
 if(scene.activity!=='sitting')return;
 const n=[...neonPeople,...neonDancers].findIndex(v=>v.name===p.name);
 const t=animationTime/1000+n*3;
 if(Math.floor(t/6)%3===2)return;
 const msg=npcDialogue[(Math.floor(t/12)+n)%npcDialogue.length];
 const w=Math.min(188,Math.max(112,msg.length*6+18));
 const x=Math.max(w/2+8,Math.min(1000-w/2-8,scene.x));
 ctx.save();ctx.globalAlpha=.94;rect(x-w/2,scene.y-100,w,34,'#f2e8f6');rect(scene.x-4,scene.y-66,8,7,'#f2e8f6');
 text(msg,x,scene.y-79,10,'#30223f');ctx.restore();
}
function neonDrawVisitors(room){
 for(const p of [...neonPeople,...neonDancers]){
  const scene=npcScene(p);if(scene.room!==room)continue;
  const profile=npcLooks[p.name];profile.walked=animationTime/120;
  const seated=scene.activity==='sitting';
  if(seated){ctx.save();ctx.translate(scene.x,scene.y);ctx.scale(1,.77);ctx.translate(-scene.x,-scene.y)}
  person(scene.x,scene.y,1,ctx,0,'down',scene.activity==='walking'||scene.activity==='arriving'||scene.activity==='leaving',animationTime/150,profile,scene.emote);
  if(seated)ctx.restore();
  text(p.name.toUpperCase(),scene.x,scene.y+27,10,'#e7d9f3');
  npcSpeech(p,scene);
  if(room===currentRoom&&Math.hypot(pos.x-scene.x,pos.y-scene.y)<78)text('E · TALK',scene.x,scene.y-56,10,'#fff4a9');
 }
}
function neonNPC(p,t){const scene=npcScene(p);if(scene.room!==currentRoom)return;const profile=npcLooks[p.name];profile.walked=animationTime/120;person(scene.x,scene.y,1,ctx,0,'down',true,animationTime/150,profile,scene.emote);text(p.name.toUpperCase(),scene.x,scene.y+27,10,'#e7d9f3');if(neonClosest()===p)text('E · TALK',scene.x,scene.y-57,10,'#fff4a9')}
function drawNeonRoom(){if(currentRoom==='arcade'){
 // The main room retains all four cabinets and the disco ball; portals lead to larger dedicated areas.
 return false;
 }if(currentRoom==='piano')return false;
 if(currentRoom==='lounge'){
 neonFloor('THE SOCIAL LOUNGE');
 text('CHAT · CHILL · CUSTOMIZE',500,83,12,'#a7dbec');
 // Boutique and counter
 rect(320,114,360,96,'#272039');rect(329,121,342,82,'#7b4b80');rect(338,129,324,66,'#272640');text('✦ PIXEL BOUTIQUE ✦',500,159,20,'#ffdd9e');
 rect(335,273,330,28,'#b37b9e');rect(341,278,318,20,'#583956');for(let i=0;i<9;i++)rect(352+i*35,282,20,6,i%2?'#f5b7d7':'#9edfe7');
 for(const x of [105,770]){rect(x,335,125,55,'#523b72');rect(x+8,338,109,22,'#a17bc1');rect(x+8,372,109,9,'#28223f')}
 rect(745,170,150,100,'#24213a');rect(753,179,134,80,'#493c60');text('SNACKS',820,195,13,'#ffce92');for(let i=0;i<4;i++)rect(767+i*29,215,19,28,['#e899b7','#9bdccf','#ffcf84','#a3b6e7'][i]);
 rect(110,170,130,80,'#3a3858');rect(120,181,110,62,'#1a2035');text('ARCADE',175,203,12,'#a6e4f0');text('LOUNGE',175,224,12,'#d9b4f4');
 neonDrawVisitors('lounge');
 }else if(currentRoom==='dance'){
 neonFloor('THE NEON DANCE FLOOR');text('MOVE · GROOVE · PRESS Q TO DANCE',500,83,12,'#b8d6ee');
 const cols=['#39c5d8','#d16bc8','#8b7de7','#e6b46f'];for(let r=0;r<9;r++)for(let j=0;j<17;j++){const v=reducedMotion.matches?.35:.28+.28*(.5+.5*Math.sin(animationTime/400+r*.9+j*.6));ctx.save();ctx.globalAlpha=v;rect(118+j*45,142+r*44,41,40,cols[(r+j)%4]);ctx.restore()}
 rect(498,88,4,60,'#8793a8');for(let yy=-19;yy<20;yy+=5)for(let xx=-19;xx<20;xx+=5)if(xx*xx+yy*yy<370)rect(500+xx,153+yy,4,4,(xx+yy+Math.floor(animationTime/250))%3?'#a9e4ef':'#f9c4ee');
 neonDrawVisitors('dance');
 }
 rect(420,560,160,40,'#433350');rect(426,566,148,28,'#1a2238');text('← MAIN ARCADE',500,585,12,'#f8d2ee');
 paintAvatarTrail();person(pos.x,pos.y,1,ctx,jumpHeight,avatarMotion.facing,avatarMotion.walking,avatarMotion.phase);text(data.name.toUpperCase().slice(0,18),pos.x,pos.y+28,10,'#f0e7cb');text('▼ YOU',pos.x,pos.y-52,10,'#d7efa9');return true}
$('loungeswitch').onclick=()=>enterRoom(currentRoom==='lounge'?'arcade':'lounge');
$('danceswitch').onclick=()=>enterRoom(currentRoom==='dance'?'arcade':'dance');
const originalEnterRoom=enterRoom;enterRoom=function(room){originalEnterRoom(room);$('loungeswitch').textContent=room==='lounge'?'← Arcade':'☕ Lounge';$('danceswitch').textContent=room==='dance'?'← Arcade':'✦ Dance Floor'};
