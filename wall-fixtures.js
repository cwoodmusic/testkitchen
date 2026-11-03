/* Wall decorations are independent originals; their light uses the exact same
 * transform as the editable sprite. No wall or floor color is part of a prop. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root){root.CodaWallFixtures=api;if(root.CodaWorldObjectCatalog)root.CodaWorldObjectCatalog.push(...api.CATALOG);}
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const SOURCE='assets/environment/source/wall-fixtures-atlas.png';
 // Reviewed, nonoverlapping source cells, including each sprite's alpha halo.
 const SPRITES=Object.freeze({
  lounge:{crop:[0,110,344,255]},coda:{crop:[348,185,483,183]},
  piano:{crop:[832,130,305,245]},hall:{crop:[1138,76,310,340]},
  boutique:{crop:[0,374,416,326]},exit:{crop:[418,432,415,268]},
  note:{crop:[839,430,292,270]},notes:{crop:[1140,430,308,270]},
  lantern:{crop:[0,704,354,382]},bottles:{crop:[382,704,410,332]},
  gem:{crop:[834,727,296,302]},keys:{crop:[1133,743,315,287]},
  classroom:{text:'CLASSROOM',width:25,height:90}
 });
 const fixtures=[];
 function add(name,label,sprite,bounds,color,kind='sign'){
  fixtures.push(Object.freeze({name:'wall_'+name,label,group:kind==='lantern'?'Wall lanterns':'Neon signs & wall art',
   type:'wall-fixture',source:'world',sprite,bounds,atlas:[0,0,bounds[2],bounds[3]],layer:'world',sortY:bounds[1]+bounds[3],
   color,kind,light:[bounds[0]+bounds[2]*.5,bounds[1]+bounds[3]*.5]}));
 }
 add('lounge_sign','Sign · Lounge','lounge',[230,35,130,65],'#ff43e0');
 add('coda_sign','Sign · The Coda Arcade','coda',[685,25,375,88],'#f25dff');
 add('piano_sign','Sign · Piano Lab','piano',[1240,18,135,70],'#37a3ff');
 add('hall_sign','Wall art · Hall of Fame','hall',[1404,144,145,148],'#ffb54b');
 add('boutique_sign','Sign · Avatar Boutique','boutique',[475,286,126,116],'#ff5ac9');
 add('exit_sign','Sign · Entrance / Exit','exit',[1410,762,130,60],'#ff3dec');
 add('bottle_art','Wall art · Neon bottle shelves','bottles',[72,83,110,113],'#ff9e36','art');
 add('north_gem','Wall art · Violet gem','gem',[506,41,35,35],'#e45bff','art');
 add('piano_keys','Wall art · Piano keys','keys',[1244,67,110,45],'#37a3ff','art');
 add('classroom_sign','Sign · Classroom','classroom',[1618,360,25,90],'#58c6dc');
 for(const[name,x,y,sprite]of [['dance_note_west',82,541,'note'],['dance_notes_west',155,541,'notes'],['dance_note_east',625,561,'note'],['dance_notes_east',674,561,'notes']])
  add(name,'Wall art · '+name.replaceAll('_',' '),sprite,[x,y,45,60],'#ff43e0','art');
 for(const[id,x,y]of [['lounge-west',83,119],['lounge-roof-west',188,103],['lounge-roof-east',210,76],['lounge-east',464,115],['arcade-west',605,57],['arcade-east',1144,56],['piano-west',1216,78],['hall-east',1568,179],['boutique-west',397,359],['dance-stage-east',613,549],['dance-upper-passage',819,502]])
  add('lantern_'+id,'Lantern · '+id.replaceAll('-',' '),'lantern',[x-33,y-34,64,70],'#ffb650','lantern');
 const CATALOG=Object.freeze(fixtures);
 const byName=new Map(CATALOG.map(item=>[item.name,item]));
 function states(assets=[],animation=()=>({dx:0,dy:0,scale:1,rot:0,alpha:1})){
  const result=[];
  function append(definition,asset){
   const [x,y,w,h]=definition.bounds,anim=asset?animation(asset):{};
   const scale=anim.scale??1,angle=(asset?.rotation||0)*Math.PI/180+(anim.rot||0);
   const sx=(asset?asset.w/w:1)*scale*(asset?.flipX?-1:1),sy=(asset?asset.h/h:1)*scale*(asset?.flipY?-1:1);
   const a=Math.cos(angle)*sx,b=Math.sin(angle)*sx,c=-Math.sin(angle)*sy,d=Math.cos(angle)*sy;
   const matrix=[a,b,c,d,(asset?.x??x+w/2)+(anim.dx||0)-a*(x+w/2)-c*(y+h/2),(asset?.y??y+h/2)+(anim.dy||0)-b*(x+w/2)-d*(y+h/2)];
   const sourceX=definition.kind==='lantern'?x+33:definition.light[0],sourceY=definition.kind==='lantern'?y+34:definition.light[1];
   result.push({id:asset?.id||definition.name,name:definition.name,kind:definition.kind,color:definition.color,
    visible:asset?.visible!==false,opacity:(asset?.opacity??100)/100*(anim.alpha??1),matrix,sourceX,sourceY,
    x:a*sourceX+c*sourceY+matrix[4],y:b*sourceX+d*sourceY+matrix[5],w:8,h:15,radius:definition.kind==='lantern'?40:Math.max(w,h)*.55});
  }
  for(const definition of CATALOG)append(definition,assets.find(asset=>asset.origin?.name===definition.name));
  for(const asset of assets)if(!asset.origin&&byName.has(asset.wallFixture))append(byName.get(asset.wallFixture),asset);
  return result;
 }
 return Object.freeze({SOURCE,SPRITES,CATALOG,states,has:name=>byName.has(name)});
});
