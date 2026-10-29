/* A native floor hatch: its interaction uses the same transform as its artwork. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.CodaFishingEntrance=value;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const NAME='rhythm_fishing_trapdoor';
 function createPicture(doc){
  const canvas=doc.createElement('canvas');canvas.width=96;canvas.height=64;const g=canvas.getContext('2d');
  g.imageSmoothingEnabled=false;
  const rect=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h);};
  rect(3,8,90,51,'#060d24');rect(5,6,86,49,'#6d55a2');rect(8,9,80,42,'#223353');
  rect(10,11,76,36,'#171e32');rect(13,13,70,31,'#5c415b');
  for(let row=0;row<5;row++){rect(14,14+row*6,68,4,row%2?'#79556c':'#67495f');rect(16,14+row*6,61,1,'#a17586');}
  rect(15,16,5,26,'#24374b');rect(76,16,5,26,'#24374b');rect(17,18,1,22,'#78bdbe');rect(78,18,1,22,'#78bdbe');
  for(const x of [17,78])for(const y of [17,39])rect(x,y,2,2,'#e8cb91');
  rect(40,24,16,11,'#16273c');rect(42,25,12,2,'#f2d99d');rect(40,27,2,6,'#b28b66');rect(54,27,2,6,'#b28b66');rect(42,33,12,2,'#b28b66');
  rect(8,48,80,3,'#49bfc2');rect(12,51,72,2,'#1c627a');rect(9,8,78,1,'#c493c3');
  // A small fish-shaped metal inlay makes the underground lake discoverable.
  rect(65,26,7,4,'#8ef5db');rect(63,27,2,2,'#8ef5db');rect(72,25,2,6,'#4ea8bd');rect(67,27,1,1,'#193047');
  return canvas;
 }
 function state(objects){
  const object=objects?.state(NAME);if(!object)return null;
  const p=objects.point(object,928,760);
  return {id:NAME,name:'Rhythm Fishing · Underground Lake',type:'fishing',x:p.x,y:p.y,visible:object.visible&&object.opacity>0,opacity:object.opacity,matrix:object.matrix.slice()};
 }
 return {NAME,createPicture,state};
});
