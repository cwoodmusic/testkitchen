// Authored in the native 1536×1024 Music Square plate. Collision describes
// occupied ground; the tighter art outline is used separately for occlusion.
const bounds=points=>{const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const x=Math.min(...xs),y=Math.min(...ys);return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};};
const piece=(id,kind,solid,outline,depth,extra={})=>Object.freeze({id,kind,...solid,outline:Object.freeze(outline.map(p=>Object.freeze(p))),clip:Object.freeze(bounds(outline)),depth,...extra});
const benchOutline=x=>[[x+10,28],[x+20,15],[x+52,15],[x+65,6],[x+91,0],[x+118,7],[x+134,15],[x+165,15],[x+176,29],[x+176,126],[x+166,130],[x+158,103],[x+25,103],[x+17,130],[x+6,129],[x+7,53],[x+12,50]].map(([px,py])=>[px,py+104]);
const flowerOutline=(x,y,w,h)=>[[x,y+h*.32],[x+w*.1,y+h*.12],[x+w*.3,y],[x+w*.55,y+h*.09],[x+w*.8,y+h*.03],[x+w,y+h*.3],[x+w,y+h],[x,y+h]];
const lamp=(id,x,y,w,h)=>piece(id,'lamp',{x:x+w*.14,y:y+h*.76,w:w*.72,h:h*.24},[[.47,0],[.62,.10],[.87,.16],[.84,.29],[.64,.39],[.64,.45],[.88,.46],[.95,.50],[.85,.56],[.65,.52],[.64,.71],[.91,.75],[.95,.96],[.75,1],[.14,1],[.08,.77],[.35,.72],[.37,.53],[.15,.49],[.05,.45],[.11,.39],[.36,.44],[.36,.37],[.16,.28],[.08,.16],[.34,.10]].map(([a,b])=>[x+a*w,y+b*h]),y+h);

export const MUSIC_SQUARE_SOLIDS=Object.freeze([
 piece('bench-west','bench',{x:304,y:174,w:180,h:60},benchOutline(298),234),
 piece('bench-east','bench',{x:1052,y:174,w:184,h:60},benchOutline(1048),234),
 ...[
  ['flowers-north-west',174,157,120,39,170,113,126,83],
  ['flowers-north-mid-west',478,148,142,36,478,101,142,83],
  ['flowers-north-mid-east',918,148,138,36,918,101,138,83],
  ['flowers-north-east',1242,156,126,40,1240,113,128,83],
  ['planter-west',178,386,134,126,177,386,136,126],
  ['planter-east',1223,386,136,126,1223,386,136,126],
  ['planter-south-west',200,705,137,124,200,705,137,124],
  ['planter-south-east',1201,704,133,125,1201,704,133,125]
 ].map(([id,x,y,w,h,cx,cy,cw,ch])=>piece(id,'planter',{x,y,w,h},flowerOutline(cx,cy,cw,ch),y+h)),
 piece('fountain','fountain',{},[[616,425],[637,400],[677,385],[726,376],[738,321],[789,321],[803,376],[850,385],[894,403],[915,425],[927,469],[928,551],[919,593],[875,624],[814,639],[742,644],[681,631],[632,606],[612,573],[604,523],[605,471]],644,{animate:true,solidOutline:[[640,397],[699,376],[827,376],[894,398],[923,440],[928,551],[916,594],[875,625],[814,641],[742,643],[681,632],[632,607],[613,573],[604,522],[607,467],[615,432]]}),
 lamp('lamp-north-west',101,8,77,264),lamp('lamp-north-east',1354,8,80,264),lamp('lamp-south-west',93,648,80,284),lamp('lamp-south-east',1368,648,80,284),
 piece('noticeboard','noticeboard',{x:1231,y:916,w:115,h:31},[[1238,842],[1261,833],[1270,827],[1303,827],[1314,833],[1340,842],[1344,942],[1334,944],[1331,922],[1246,922],[1242,945],[1232,943]],947),
 piece('wall-north-west','wall',{},[[33,75],[53,47],[612,47],[612,112],[47,112],[33,100]],112,{collision:false}),
 piece('wall-north-east','wall',{},[[925,47],[1486,47],[1504,75],[1504,100],[1488,112],[925,112]],112,{collision:false}),
 piece('wall-south-west','wall',{},[[33,948],[584,948],[584,1013],[49,1013],[33,998]],1013,{collision:false}),
 piece('wall-south-east','wall',{},[[947,948],[1504,948],[1504,998],[1488,1013],[947,1013]],1013,{collision:false})
]);
const scaledPoint=(p,w,h)=>[p[0]*w/1536,p[1]*h/1024];
export function musicSquareCollisionGeometry(w=2400,h=1600){
 return {
  boxes:MUSIC_SQUARE_SOLIDS.filter(p=>p.collision!==false&&Number.isFinite(p.x)).map(p=>({x:p.x*w/1536,y:p.y*h/1024,w:p.w*w/1536,h:p.h*h/1024})),
  polygons:MUSIC_SQUARE_SOLIDS.filter(p=>p.solidOutline).map(p=>p.solidOutline.map(q=>scaledPoint(q,w,h)))
 };
}
export function musicSquareSceneParts(w=2400,h=1600){return MUSIC_SQUARE_SOLIDS.map(p=>({id:p.id,kind:p.kind,outline:p.outline.map(q=>scaledPoint(q,w,h)),depth:p.depth*h/1024,animate:!!p.animate}));}

export function decorCollisionBoxes(def,w,h){
 if(def.mount)return [];
 const box=(x,y,bw,bh)=>({x:x*w,y:y*h,w:bw*w,h:bh*h});
 if(/arch|pergola|garden gate/i.test(def.name))return [box(0,.72,.13,.28),box(.87,.72,.13,.28)];
 if(def.group==='street furniture'){
  if(def.index<=4)return [box(.04,.54,.92,.44)];
  if(def.index<=7)return [box(.05,.48,.90,.50)];
 }
 if(def.group==='garden pots')return [box(.08,.50,.84,.48)];
 if(def.group==='foliage and rocks')return [box(.08,.57,.84,.41)];
 if(def.group==='market goods'&&def.index<=7)return [box(.06,.57,.88,.41)];
 return [box(.16,.76,.68,.22)];
}
export function propCollisionBoxes(index,w,h){
 const box=(x,y,bw,bh)=>({x:x*w,y:y*h,w:bw*w,h:bh*h});
 if(index===4)return [box(.025,.65,.235,.31),box(.74,.65,.235,.31),box(.26,.57,.105,.42),box(.655,.57,.105,.42),box(.10,.43,.055,.24),box(.845,.43,.055,.24),box(.14,.55,.72,.10)];
 if(index===1)return [box(.04,.54,.92,.44)];
 if(index===0||index===5)return [box(.08,.56,.84,.42)];
 if(index===3)return [box(.08,.50,.84,.48)];
 return [{x:w*.15,y:h-45,w:w*.7,h:40}];
}
export function gazeboSceneParts(w,h){
 const part=(id,kind,points,depth)=>({id,kind,outline:points.map(([x,y])=>[x*w,y*h]),depth:depth*h});
 const left=[[.30,.415],[.34,.435],[.34,.80],[.37,.82],[.37,.99],[.25,.99],[.25,.82],[.28,.80],[.28,.47]],leftPlanter=[[.02,.72],[.07,.66],[.13,.66],[.18,.73],[.24,.73],[.26,.91],[.21,.97],[.07,.93],[.02,.90]];
 const mirror=points=>points.map(([x,y])=>[1-x,y]);
 return [
  part('gazebo-roof','roof',[[.05,.294],[.22,.214],[.36,.176],[.36,.113],[.47,.041],[.51,0],[.65,.090],[.65,.172],[.81,.226],[.94,.289],[.94,.34],[.91,.372],[.77,.414],[.73,.462],[.66,.473],[.50,.442],[.35,.478],[.29,.461],[.24,.415],[.07,.371],[.04,.339]],.96),
  part('gazebo-rear-rail','railing',[[.14,.54],[.86,.54],[.86,.65],[.14,.65]],.65),
  part('gazebo-post-west','post',left,.99),part('gazebo-post-east','post',mirror(left),.99),
  part('gazebo-flowers-west','planter',leftPlanter,.97),part('gazebo-flowers-east','planter',mirror(leftPlanter),.97)
 ];
}
// The interior floor plate remains exact; only the visible plinth extends
// beyond it. The entry marker is still an interaction point outside the wall.
export function urbanBuildingCollision(footprint,front){
 return {boxes:[{...footprint},{x:footprint.x-24,y:front-80,w:footprint.w+48,h:104}],front:front+24,left:footprint.x-24,right:footprint.x+footprint.w+24};
}
