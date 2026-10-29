/* Browser-safe props assembled from the original hero's cap, emblem, hands,
 * footwear and the original green visitor's glasses. No external art plates. */
module.exports=function buildOriginalAccessoryLayers(options){
  const {atlas,heroFrames,headLayers}=options,W=80,H=96,dirs=['down','left','up','right'];
  const make=(w=W,h=H)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const context=c=>c.getContext('2d',{willReadFrequently:true});
  const clone=c=>{const out=make(c.width,c.height);context(out).drawImage(c,0,0);return out;};
  const crop=(x,y,w,h)=>{const out=make(w,h);context(out).drawImage(atlas,x,y,w,h,0,0,w,h);return out;};
  const mask=(source,keep)=>{const out=clone(source),g=context(out),p=g.getImageData(0,0,out.width,out.height);for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){const at=(y*out.width+x)*4;if(!keep(x,y,p.data,at))p.data[at+3]=0;}g.putImageData(p,0,0);return out;};
  const bounds=c=>{const p=context(c).getImageData(0,0,c.width,c.height).data;let x1=c.width,y1=c.height,x2=-1,y2=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]){x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);}return x2<0?null:[x1,y1,x2-x1+1,y2-y1+1];};
  const stamp=(out,source,x,y,w,h,flip=false)=>{const box=bounds(source);if(!box)return;const g=context(out);g.save();g.imageSmoothingEnabled=false;if(flip){g.translate(x+w,y);g.scale(-1,1);x=0;y=0;}g.drawImage(source,...box,x,y,w,h);g.restore();};
  const dye=(source,hex)=>{const out=clone(source),g=context(out),p=g.getImageData(0,0,out.width,out.height),color=[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16));for(let at=0;at<p.data.length;at+=4){if(!p.data[at+3])continue;const value=Math.max(p.data[at],p.data[at+1],p.data[at+2])/255;const metal=color[0]>150&&color[1]>100&&color[2]<color[1]*.85;if(value<.15&&!metal)continue;const light=(p.data[at]*.3+p.data[at+1]*.59+p.data[at+2]*.11)/255,shade=Math.max(metal ? .46 : .3,Math.min(1.2,.55+light*.7));for(let c=0;c<3;c++)p.data[at+c]=Math.round(Math.min(255,color[c]*shade));}g.putImageData(p,0,0);return out;};
  const outline=source=>{const out=clone(source),g=context(out),p=g.getImageData(0,0,out.width,out.height),alpha=new Uint8Array(out.width*out.height);for(let at=0;at<alpha.length;at++)alpha[at]=p.data[at*4+3];for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){if(!alpha[y*out.width+x])continue;let edge=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=out.width||yy>=out.height||!alpha[yy*out.width+xx])edge=true;}if(!edge)p.data[(y*out.width+x)*4+3]=0;}g.putImageData(p,0,0);return out;};
  const front=heroFrames.hero_down_0,frontPixels=crop(front.x,front.y,front.w,front.h);
  const emblem=mask(frontPixels,(x,y,p,at)=>y<20&&p[at+2]>p[at]*1.25&&p[at+2]>p[at+1]*1.05&&p[at+2]>45);
  const redWing=mask(frontPixels,(x,y,p,at)=>y<21&&p[at]>p[at+1]*1.8&&p[at]>p[at+2]*1.5&&x<17);
  const hand=mask(crop(front.x+2,front.y+44,11,13),(x,y,p,at)=>p[at]>p[at+1]*1.1&&p[at+1]>p[at+2]*1.1||Math.max(p[at],p[at+1],p[at+2])<65);
  const glassRaw=crop(22,270,33,15),glasses=mask(glassRaw,(x,y,p,at)=>Math.max(p[at],p[at+1],p[at+2])<85||Math.min(p[at],p[at+1],p[at+2])>205);
  const headwear=Object.fromEntries(['cap','beanie','bucket','crown','headwrap'].map(id=>[id,[]]));
  const eyewear=Object.fromEntries(['glasses','sunglasses','partyglasses'].map(id=>[id,[]]));
  const accessory=Object.fromEntries(['bow','bowtie','starclip','halo','earrings','headphones','pixelheadphones','trumpet','microphone'].map(id=>[id,[]]));
  for(let dir=0;dir<4;dir++){
    const f=heroFrames['hero_'+dirs[dir]+'_0'],top=88-f.h,cap=headLayers.headwear.cap[dir],end=top+[27,22,27,15][dir],eyeY=top+[31,26,31,20][dir]-1;
    headwear.cap.push(clone(cap));
    const dome=mask(cap,(x,y)=>y<end-5),rim=mask(cap,(x,y)=>y>=end-6&&y<end);
    headwear.beanie.push(dye(dome,'#318d9b'));
    const bucket=dye(dome,'#8868b5');context(bucket).drawImage(dye(rim,'#644a97'),0,0);headwear.bucket.push(bucket);
    const crown=make(),gold=dye(emblem,'#edc45c'),goldRim=dye(rim,'#dfb24c');
    stamp(crown,goldRim,25,top+10,30,4);for(const x of [25,37,49])stamp(crown,gold,x,top-1,6,12);headwear.crown.push(crown);
    const wrap=dye(dome,'#398a91');stamp(wrap,goldRim,22,top+12,36,4);const wg=context(wrap);wg.save();wg.translate(40,top+10);wg.rotate(dir===3?-.5:.5);wg.drawImage(dye(rim,'#dcb14f'),22,Math.max(0,end-6),36,5,-17,0,34,5);wg.restore();headwear.headwrap.push(wrap);
    for(const id of Object.keys(eyewear)){const out=make(),side=dir%2,source=id==='glasses'?glasses:dye(glasses,id==='sunglasses'?'#20232e':'#cb79b8');stamp(out,source,side?(dir===1?24:37):25,eyeY,side?18:30,8,dir===3);if(id==='partyglasses')stamp(out,dye(emblem,'#71c8dc'),dir===1?26:dir===3?48:45,eyeY-1,6,9);eyewear[id].push(out);}
    const bow=make();stamp(bow,dye(redWing,'#e6749e'),51,top+1,7,8);stamp(bow,dye(redWing,'#e6749e'),58,top+1,7,8,true);accessory.bow.push(bow);
    const tie=make(),neck=top+[43,36,42,30][dir];stamp(tie,dye(redWing,'#de718c'),35,neck,5,5);stamp(tie,dye(redWing,'#de718c'),40,neck,5,5,true);accessory.bowtie.push(tie);
    const clip=make();stamp(clip,gold,54,top+5,6,8);accessory.starclip.push(clip);
    const halo=make();stamp(halo,dye(outline(dome),'#ecd174'),23,Math.max(2,top-7),34,6);accessory.halo.push(halo);
    const ears=make();for(const x of dir===1?[48]:dir===3?[27]:[20,57])stamp(ears,gold,x,eyeY+7,3,6);accessory.earrings.push(ears);
    for(const id of ['headphones','pixelheadphones']){const out=make(),band=dye(outline(dome),id==='headphones'?'#68b5ce':'#c37db6');context(out).drawImage(band,0,0);for(const x of dir===1?[47]:dir===3?[21]:[18,55])stamp(out,dye(hand,id==='headphones'?'#746797':'#76b6c2'),x,eyeY-3,7,11);accessory[id].push(out);}
    const trumpet=make(),tx=[55,17,17,44][dir],ty=neck+5;
    if(dir%2){stamp(trumpet,dye(rim,'#d7ad50'),tx+3,ty+4,15,2);stamp(trumpet,dye(redWing,'#ebbd58'),dir===1?tx:tx+15,ty,7,10,dir===3);stamp(trumpet,gold,tx+8,ty+1,2,7);stamp(trumpet,gold,tx+12,ty+1,2,7);}else{stamp(trumpet,dye(rim,'#d7ad50'),tx+3,ty,2,14);stamp(trumpet,gold,tx,ty+8,8,7);}accessory.trumpet.push(trumpet);
    const mic=make(),mx=[56,24,19,51][dir];stamp(mic,dye(emblem,'#a8b2c4'),mx-1,neck+1,7,6);stamp(mic,dye(rim,'#344252'),mx+1,neck+6,3,10);accessory.microphone.push(mic);
  }
  function inked(source){
    const out=clone(source),g=context(out),pixels=g.getImageData(0,0,W,H),base=pixels.data.slice();
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
      const at=(y*W+x)*4;if(base[at+3])continue;let neighbor=false;
      for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])if(base[((y+dy)*W+x+dx)*4+3])neighbor=true;
      if(neighbor){pixels.data[at]=0;pixels.data[at+1]=0;pixels.data[at+2]=7;pixels.data[at+3]=255;}
    }
    g.putImageData(pixels,0,0);return out;
  }
  headwear.crown=headwear.crown.map(inked);
  for(const id of ['starclip','halo','earrings','trumpet'])accessory[id]=accessory[id].map(inked);
  return {headwear,eyewear,accessory,metadata:{source:'coda_arcade_phase73_characters.png',method:'original cap, emblem, gloves and visitor glasses with native-pixel cloning'}};
};
