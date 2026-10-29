// Four-direction pixel sprites assembled from the player's existing cosmetics.
const avatarMotion={facing:'down',walking:false,phase:0,previewFacing:'down'};
const legacyFrontAvatar=person;
function avatarStep(dx,dy,distance,dt){avatarMotion.walking=distance>.01;if(!avatarMotion.walking)return;if(Math.abs(dx)>Math.abs(dy))avatarMotion.facing=dx>0?'right':'left';else avatarMotion.facing=dy>0?'down':'up';avatarMotion.phase+=distance/9}
function drawAvatarShoe(r,x,y,kind,lift){const col={sneakers:'#ece1ff',boots:'#795443',hightops:'#f09ba9',neon:'#8df4d5',gold:'#ffdb7b',rocket:'#aebbe5'}[kind]||'#ece1ff';if(kind==='boots'||kind==='rocket')r(x,y-5,7,8,col);else if(kind==='hightops')r(x,y-3,7,6,col);r(x,y,7,4,col);r(x,y+3,7,2,'#dce2ed');if(kind==='hightops'){r(x+2,y-2,3,1,'#fff');r(x+2,y,3,1,'#fff')}if(kind==='gold')r(x+2,y,3,2,'#fff6c7');if(kind==='rocket'){r(x-1,y-4,9,5,'#9baac7');r(x+1,y-3,4,3,'#e7a0db');if(lift>0){r(x+1,y+5,5,5,'#8ae9ed');r(x+2,y+10,3,4,'#ffe4a0')}}}
function directionalHair(r,side,back){const h=data.hair,t=data.hairstyle;if(t==='bald')return;r(-10,-42,20,7,h);if(back){r(-10,-37,20,13,h);r(-8,-25,16,3,h)}else{r(-10,-37,7,13,h);r(-4,-37,10,4,h)}if(t==='bob'){r(-11,-38,side?9:22,18,h);if(side)r(-6,-24,4,6,h)}if(t==='long'){r(-11,-39,side?9:22,32,h);r(-9,-9,side?6:18,4,h)}if(t==='ponytail'){r(side?-19:-4,-35,side?11:8,22,h);r(side?-17:-4,-32,side?9:8,3,data.shirt)}if(t==='curly'){for(const [x,y]of[[-12,-42],[-6,-46],[1,-46],[7,-43],[-13,-35],[-8,-28]]){r(x,y,8,8,h);r(x+2,y-2,4,11,h)}}if(t==='buns'){r(-17,-47,10,11,h);r(7,-47,10,11,h);r(-15,-49,6,14,h);r(9,-49,6,14,h)}if(t==='spiky'){r(-10,-48,4,9,h);r(-3,-51,4,12,h);r(5,-47,4,8,h)}}
function directionalGear(r,side,back,lift){const a=data.accessory,cf='#f7daa1';
 if(['headphones','pixelheadphones'].includes(a)){const earned=a==='pixelheadphones',band=earned?'#f8c66b':'#71d9ed';r(-13,-44,26,4,band);r(-15,-40,4,16,band);r(11,-40,4,16,band);r(side?-10:-16,-33,side?10:6,12,earned?'#ec80cd':'#b78ee8');if(!side)r(10,-33,6,12,earned?'#8ae7ef':'#b78ee8');if(earned)r(side?-7:-14,-30,3,6,'#fff0bf')}
 if(['cap','backwardcap'].includes(a)){const reverse=a==='backwardcap',col=reverse?'#8bcfc1':'#eb8d83';r(-12,-46,24,10,col);r(-9,-48,18,3,col);if(side)r(reverse?-20:4,-38,16,4,reverse?'#5a9d9a':'#ffd2a1');else r(-13,-38,26,4,col);if(back&&!reverse){r(-5,-42,10,5,'#29293c');r(-3,-41,6,2,cf)}}
 if(a==='bow'){r(side?-9:4,-45,7,8,'#f3a4ce');r(side?-1:13,-45,7,8,'#f3a4ce');r(side?-3:10,-43,4,5,'#e372a8')}
 if(['sunglasses','lightningglasses','starglasses','partyglasses'].includes(a)){const color={sunglasses:'#222438',lightningglasses:'#f2dc77',starglasses:'#ef9ddc',partyglasses:'#ed80d0'}[a];if(side){r(-5,-32,13,2,color);r(5,-34,5,7,color);if(a==='lightningglasses'){r(6,-28,3,5,color);r(5,-24,2,3,color)}if(a==='starglasses'){r(3,-32,9,3,color);r(6,-36,3,11,color)}}else r(-11,-32,22,2,color)}
 if(['starclip','noteclip'].includes(a)){const x=side?-4:7;if(a==='starclip'){r(x,-40,3,9,'#fff29b');r(x-3,-37,9,3,'#fff29b')}else{r(x,-39,3,9,cf);r(x-3,-32,5,3,cf)}}
 if(['racehelmet','robothelmet'].includes(a)){const robot=a==='robothelmet',col=robot?'#a6bbcd':'#ee948c';r(-13,-45,26,23,col);r(-15,-40,30,13,col);if(side){r(5,-36,10,8,'#252b43');r(7,-34,5,2,'#80eff0')}if(back){r(-9,-35,18,3,robot?'#738caa':'#fff0be');r(-7,-29,14,3,'#475a76')}if(robot){r(-1,-53,2,9,'#b4cad4');r(-4,-56,8,4,'#f495c8')}else{r(-2,-46,4,10,'#fff0be');r(-12,-25,24,4,'#fff0be')}}
 if(a==='discohelmet'){for(let yy=-19;yy<=19;yy+=4)for(let xx=-19;xx<=19;xx+=4)if(xx*xx+yy*yy<370)r(xx,-36+yy,3,3,(xx+yy+(reducedMotion.matches?0:Math.floor(animationTime/250)*4))%12===0?'#f4faff':xx<0?'#b1c5e8':'#86d3dc');if(side){r(9,-34,9,7,'#29324e');r(11,-32,4,2,'#a3f3e9')}r(-16,-54,9,2,'#fff7ca');r(-13,-57,2,8,'#fff7ca')}
 if(a==='wizardhat'){r(-14,-41,28,4,'#bc8ee7');r(-9,-49,18,9,'#8f67c8');r(-5,-57,10,10,'#8f67c8');r(-1,-62,4,7,'#d4b2f7')}
 if(['crown','clefcrown'].includes(a)){const col=a==='crown'?'#ffda7b':'#9be8ed';r(-12,-45,24,6,col);for(let xx=-12;xx<=8;xx+=10)r(xx,-51,4,9,col);if(a==='clefcrown'){r(-1,-61,3,22,cf);r(1,-63,4,3,cf);r(4,-61,2,5,cf);r(-4,-54,8,3,cf);r(-6,-52,3,7,cf);r(-4,-46,9,3,cf);r(4,-50,3,6,cf)}}
 if(a==='buckethat'){r(-11,-47,22,10,'#8ecac4');r(-15,-39,30,4,'#8ecac4')}
 if(a==='bowtie'&&side){r(7,-19,4,5,'#f08cb8')}
 if(a==='wristbands'){r(side?3:-12,-9,4,4,'#f48ac9');if(!side)r(8,-9,4,4,'#82e5ef')}
 if(['guitarbag','drumbag'].includes(a)){const x=side?-17:-9;r(x,-20,side?10:18,23,'#9d79cd');r(x+2,-18,side?6:14,3,'#b99be1');if(a==='guitarbag'){r(x+4,-37,4,25,'#ddad78');r(x+1,-18,11,7,'#e8aa7d');r(x-1,-11,15,10,'#e8aa7d');r(x+4,-14,4,5,'#3d3053');r(x+6,-28,1,24,'#fbe0ad')}else{r(x+2,-36,3,25,'#e9c69b');r(x+9,-34,3,25,'#e9c69b')}}
 if(a==='staff'){r(side?11:18,-27,3,36,'#c7a4dc');r(side?7:14,-33,11,9,'#94e4f0')}
 if(['cardfriend','drumfriend'].includes(a)){const f=reducedMotion.matches?0:Math.round(Math.sin(animationTime/350)*3);if(a==='cardfriend'){r(23,-26+f,13,19,'#bda2e2');r(25,-24+f,9,15,'#3b315c');r(28,-20+f,3,7,'#e1dcad')}else{r(22,-18+f,18,12,'#dba0d5');r(21,-20+f,20,4,'#e9e0ed');r(21,-7+f,20,3,'#e9e0ed')}}
 if(a==='rainbowtrail')for(let n=0;n<5;n++)r(-25+n*5,13,5,3,['#f19cbb','#edc984','#ace1b3','#86d5ed','#ba9cdd'][n]);
 if(data.hat&&data.walked>=450){r(-13,-50,26,3,'#d5ff71');r(-16,-47,3,4,'#d5ff71');r(13,-47,3,4,'#d5ff71')}
}
function directionalBody(r,side,back,phase,lift){const stride=Math.round(Math.sin(phase)*3),dress=data.outfit==='dress',shorts=data.outfit==='shorts',overalls=data.outfit==='overalls';
 if(data.accessory==='cape'){r(-12,-18,24,8,'#c779b5');r(-15,-10,30,10,'#bf6cad');r(-18,0,36,7,'#a95b9d')}
 const legColor=shorts||dress?data.skin:overalls?'#486ca7':'#7765a1';
 for(let i=0;i<2;i++){const x=side?(i?0:-6):(i?2:-7),shift=(i?stride:-stride);r(x,-3+Math.min(0,shift),5,10,legColor);drawAvatarShoe(r,x-1,6+shift,data.shoes,lift)}
 r(side?-7:-9,-20,side?14:18,18,data.shirt);
 if(shorts)r(side?-7:-8,-5,side?14:16,7,'#7765a1');
 if(overalls){r(side?-7:-8,-15,side?14:16,14,'#486ca7');r(side?3:-7,-21,3,13,'#486ca7');if(!side)r(4,-21,3,13,'#486ca7');if(back){r(-4,-14,8,3,'#325180')}else if(side)r(5,-17,2,2,'#ffe19a')}
 if(dress){r(side?-9:-11,-13,side?18:22,8,data.shirt);r(side?-11:-14,-5,side?22:28,5,data.shirt)}
 if(side)r(3,-17+stride,4,14,data.skin);else{r(-12,-17+stride,4,14,data.skin);r(8,-17-stride,4,14,data.skin)}
 if(back&&data.accessory==='cape'){r(-11,-19,22,14,'#c779b5');r(-15,-5,30,10,'#bf6cad')}
 // Backpacks are drawn over the back of the torso, beneath the hair.
 r(side?-9:-10,-39,side?18:20,20,data.skin);
 if(side){r(9,-32,3,6,data.skin);r(5,-32,3,3,'#292035');r(-5,-31,4,5,'#bc8066')}
 directionalHair(r,side,back);
}
person=function(x,y,scale=1,paint=ctx,lift=0,direction='down',walking=false,phase=0){
 if(direction==='down'&&!walking){legacyFrontAvatar(x,y,scale,paint,lift);return}
 const side=direction==='left'||direction==='right',back=direction==='up';paint.save();paint.translate(Math.round(x),Math.round(y));paint.scale(scale,scale);paint.fillStyle='#0006';paint.beginPath();paint.ellipse(0,5,Math.max(9,17-lift*.1),Math.max(2,5-lift*.035),0,0,7);paint.fill();paint.translate(0,-lift);
 const dancing=activeEmote&&animationTime<emoteUntil;const motion=reducedMotion.matches?0:phase;const bob=walking?Math.round(Math.abs(Math.sin(motion))*1):0;paint.translate(0,-bob);
 if(side&&direction==='left')paint.scale(-1,1);
 function r(x,y,w,h,color){paint.fillStyle=color;paint.fillRect(Math.round(x),Math.round(y),w,h)}
 if(direction==='down'){
  const stride=Math.round(Math.sin(motion)*3),color=['dress','shorts'].includes(data.outfit)?data.skin:data.outfit==='overalls'?'#486ca7':'#7765a1';
  for(let i=0;i<2;i++){const xx=i?2:-7,shift=i?stride:-stride;r(xx,-3+Math.min(0,shift),5,10,color);drawAvatarShoe(r,xx-1,6+shift,data.shoes,lift)}
  paint.save();paint.beginPath();paint.rect(-50,-90,100,88);paint.clip();legacyFrontAvatar(0,0,1,paint,0);paint.restore();
  if(data.outfit==='dress')r(-14,-5,28,5,data.shirt);
 }else{
  if(dancing){const t=(animationTime-emoteStart)/1000;if(['spin','breakdance'].includes(activeEmote))paint.rotate(t*(activeEmote==='spin'?5:7));else if(activeEmote==='robot')paint.rotate(Math.round(Math.sin(t*4))*.12);else if(activeEmote==='moonwalk')paint.translate(Math.sin(t*3)*8,0);else paint.translate(Math.sin(t*7)*2,-Math.abs(Math.sin(t*7))*3)}
  directionalBody(r,side,back,walking?motion:0,lift);directionalGear(r,side,back,lift);
  if(dancing&&['wave','cheer','disco'].includes(activeEmote)){r(side?5:9,-34,4,17,data.skin);r(side?4:8,-38,6,6,data.skin)}
 }
 paint.restore();
};
