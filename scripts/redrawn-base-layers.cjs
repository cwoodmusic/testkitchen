/* Browser-safe extraction of the redrawn, genuinely hatless neutral avatar.
 * Serialized by the sprite baker; all garment variants clone its own pixels. */
module.exports=function buildRedrawnBaseLayers(options){
  'use strict';
  const atlas=options.atlas,cell=options.cell||[80,96],anchor=options.anchor||[40,88];
  const W=cell[0],H=cell[1],directions=['down','left','up','right'];
  const make=(w=W,h=H)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const context=c=>c.getContext('2d',{willReadFrequently:true});
  const copy=c=>{const out=make(c.width,c.height);context(out).drawImage(c,0,0);return out;};
  const output=pixels=>{const out=make();context(out).putImageData(pixels,0,0);return out;};
  const hsv=(r,g,b)=>{const hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo;let h=delta?hi===r?((g-b)/delta)%6:hi===g?(b-r)/delta+2:(r-g)/delta+4:0;return {h:(h*60+360)%360,s:hi?delta/hi:0,v:hi/255};};
  const rgb=(h,s,v)=>{const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const values=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return values.map(n=>Math.round((n+m)*255));};
  const skin=(r,g,b)=>{const color=hsv(r,g,b);return color.h>=4&&color.h<=65&&color.s>=.2&&color.v>=.2&&r>g*1.04;};
  const outfit=Object.fromEntries(['pants','shorts','dress','overalls','suit','coat'].map(id=>[id,[]]));
  const shoes=Object.fromEntries(['sneakers','boots','hightops','neon','gold'].map(id=>[id,[]]));
  const body=[],original=[];
  const metadata={source:'assets/characters/source/base-avatar-gray.png',method:'redrawn bald neutral with garments cloned from the same artwork',space:'fitted-cell',cell:cell.slice(),anchor:anchor.slice(),directions,sourceCrops:[],headWindows:[],faceWindows:[],neck:[],eyeY:[],frames:[],rig:[],neutralColors:{shirt:'#999ca6',lowerColor:'#626875'},materials:{pants:'gray-clothes',shorts:'clothes',dress:'clothes',overalls:'clothes',suit:'clothes',coat:'clothes'}};
  for(let dir=0;dir<4;dir++){
    const fullWidth=atlas.naturalWidth||atlas.width,fullHeight=atlas.naturalHeight||atlas.height;
    const quarterX=Math.floor(dir*fullWidth/4),quarterRight=Math.floor((dir+1)*fullWidth/4),qw=quarterRight-quarterX;
    const quarter=make(qw,fullHeight),qg=context(quarter);qg.drawImage(atlas,quarterX,0,qw,fullHeight,0,0,qw,fullHeight);
    const source=qg.getImageData(0,0,qw,fullHeight),data=source.data,seen=new Uint8Array(qw*fullHeight);let largest=[];
    // Generated transparency can contain distant alpha=1 specks. Select the
    // actual connected figure, never the nonzero-alpha bounds of the quadrant.
    for(let seed=0;seed<seen.length;seed++)if(data[seed*4+3]>=128&&!seen[seed]){
      const queue=[seed];seen[seed]=1;
      for(let at=0;at<queue.length;at++){
        const id=queue[at],x=id%qw,y=Math.floor(id/qw);
        for(let yy=Math.max(0,y-1);yy<=Math.min(fullHeight-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(qw-1,x+1);xx++){
          const next=yy*qw+xx;if(!seen[next]&&data[next*4+3]>=128){seen[next]=1;queue.push(next);}
        }
      }
      if(queue.length>largest.length)largest=queue;
    }
    if(!largest.length)throw Error('Redrawn avatar is empty: '+directions[dir]);
    const mask=new Uint8Array(seen.length);let minX=qw,minY=fullHeight,maxX=-1,maxY=-1;
    for(const id of largest){mask[id]=1;const x=id%qw,y=Math.floor(id/qw);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    for(let id=0;id<mask.length;id++)data[id*4+3]=mask[id]?255:0;
    qg.putImageData(source,0,0);
    const crop={x:quarterX+minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};metadata.sourceCrops.push(crop);
    const height=53,width=Math.round(Math.min(39,height*crop.w/crop.h)),left=Math.round(anchor[0]-width/2),top=anchor[1]-height;
    const fitted=make(),g=context(fitted);g.imageSmoothingEnabled=false;g.drawImage(quarter,minX,minY,crop.w,crop.h,left,top,width,height);
    const pixels=g.getImageData(0,0,W,H),raw=pixels.data;
    original.push(copy(fitted));body.push(copy(fitted));
    const grayAt=(x,y)=>{const at=(y*W+x)*4,r=raw[at],green=raw[at+1],b=raw[at+2];return raw[at+3]&&Math.max(r,green,b)>45&&Math.abs(r-green)<45&&Math.abs(green-b)<45&&!skin(r,green,b);};
    let clothesTop=64;
    for(let y=59;y<74;y++){let count=0;for(let x=32;x<49;x++)if(grayAt(x,y))count++;if(count>=7){clothesTop=y;break;}}
    const brightness=y=>{let sum=0,count=0;for(let x=34;x<47;x++){const at=(y*W+x)*4;if(grayAt(x,y)){sum+=Math.max(raw[at],raw[at+1],raw[at+2]);count++;}}return count?sum/count:0;};
    let waist=76,bestDrop=8;
    for(let y=Math.max(72,clothesTop+7);y<=80;y++){const drop=brightness(y-1)-brightness(y);if(drop>bestDrop){bestDrop=drop;waist=y;}}
    const shoeTop=anchor[1]-5,bottom=anchor[1]-1;
    const headPixels=[];for(let y=top;y<clothesTop;y++)for(let x=0;x<W;x++)if(raw[(y*W+x)*4+3])headPixels.push([x,y]);
    const head={x:Math.min(...headPixels.map(p=>p[0])),y:Math.min(...headPixels.map(p=>p[1])),w:Math.max(...headPixels.map(p=>p[0]))-Math.min(...headPixels.map(p=>p[0]))+1,h:clothesTop-top};
    const side=dir===1||dir===3,face=dir===2?null:{x:head.x+Math.round(head.w*(dir===1?.05:dir===3?.30:.17)),y:head.y+Math.round(head.h*.48),right:head.x+Math.round(head.w*(dir===1?.70:dir===3?.95:.83)),bottom:clothesTop-1};
    metadata.headWindows.push(head);metadata.faceWindows.push(face);metadata.neck.push(clothesTop);metadata.eyeY.push(clothesTop-10);
    const sourceClothes=g.createImageData(W,H),canonical=g.createImageData(W,H),upper=[],lower=[],ink=[],legPixels=[];
    const dyePixel=(target,to,from,role)=>{
      target[to+3]=raw[from+3];let values=Array.from(raw.slice(from,from+3));const color=hsv(...values);
      if(role&&color.v>=.15){const hue=role==='upper'?300:role==='lower'?220:115;values=rgb(hue,role==='skin'?.5:.45,color.v);}
      for(let channel=0;channel<3;channel++)target[to+channel]=values[channel];
    };
    for(let y=clothesTop;y<shoeTop;y++)for(let x=0;x<W;x++){
      const at=(y*W+x)*4;if(!raw[at+3]||skin(raw[at],raw[at+1],raw[at+2]))continue;
      const role=y<waist?'upper':'lower';dyePixel(sourceClothes.data,at,at);dyePixel(canonical.data,at,at,role);
      const item={x,y,at};(role==='upper'?upper:lower).push(item);if(Math.max(raw[at],raw[at+1],raw[at+2])<55)ink.push(item);
      if(y>=waist&&x>=anchor[0]-10&&x<=anchor[0]+10)legPixels.push(item);
    }
    if(!upper.length||!lower.length)throw Error('Redrawn clothing could not be identified: '+directions[dir]);
    const duplicate=image=>new ImageData(new Uint8ClampedArray(image.data),W,H);
    const nearest=(samples,x,y)=>{let chosen=samples[0],distance=Infinity;for(const p of samples){const d=Math.abs(p.x-x)+Math.abs(p.y-y)*.7;if(d<distance){distance=d;chosen=p;}}return chosen;};
    const clone=(target,x,y,role,edge=false)=>{if(x<0||x>=W||y<clothesTop||y>=shoeTop)return;const pool=edge&&ink.length?ink:role==='lower'?lower:upper,p=nearest(pool,x,y);dyePixel(target.data,(y*W+x)*4,p.at,edge?null:role);};
    outfit.pants.push(output(sourceClothes));
    const shorts=duplicate(canonical);for(const p of legPixels)if(p.y>=shoeTop-4&&hsv(...raw.slice(p.at,p.at+3)).v>=.15)dyePixel(shorts.data,p.at,p.at,'skin');outfit.shorts.push(output(shorts));
    const overalls=duplicate(canonical);for(let y=clothesTop+3;y<waist;y++)for(let x=35;x<45;x++)if(overalls.data[(y*W+x)*4+3])clone(overalls,x,y,'lower');outfit.overalls.push(output(overalls));
    const suit=duplicate(canonical);if(dir!==2)for(let y=clothesTop+2;y<Math.min(waist,clothesTop+9);y++)for(const x of [35,44])if(suit.data[(y*W+x)*4+3])clone(suit,x,y,'upper',true);outfit.suit.push(output(suit));
    const dress=duplicate(canonical),half=side?7:10;
    for(let y=waist;y<shoeTop;y++){const flare=Math.floor((y-waist)/3),lo=anchor[0]-half-flare,hi=anchor[0]+half+flare;for(let x=lo;x<=hi;x++)clone(dress,x,y,'upper',x===lo||x===hi||y===shoeTop-1);}
    outfit.dress.push(output(dress));
    const coat=duplicate(suit),xs=legPixels.map(p=>p.x),lo=Math.max(anchor[0]-12,Math.min(...xs)-1),hi=Math.min(anchor[0]+12,Math.max(...xs)+1);
    for(let y=waist-1;y<shoeTop-1;y++)for(let x=lo;x<=hi;x++)if(x<38||x>42)clone(coat,x,y,'upper',x===lo||x===hi||y===shoeTop-2);outfit.coat.push(output(coat));
    const foot=g.createImageData(W,H);for(let y=shoeTop;y<=bottom;y++)for(let x=0;x<W;x++){const at=(y*W+x)*4;if(raw[at+3])dyePixel(foot.data,at,at);}
    for(const id of Object.keys(shoes)){
      const result=duplicate(foot),target={boots:[25,.48],hightops:[325,.46],neon:[165,.64],gold:[43,.72]}[id];
      if(target)for(let at=0;at<result.data.length;at+=4){if(!result.data[at+3])continue;const color=hsv(...result.data.slice(at,at+3));if(color.v<.18||color.v>.9&&color.s<.15)continue;const values=rgb(target[0],target[1],color.v);for(let c=0;c<3;c++)result.data[at+c]=values[c];}
      if(id==='boots'||id==='hightops')for(let x=0;x<W;x++){let first=-1;for(let y=shoeTop;y<=bottom;y++)if(result.data[(y*W+x)*4+3]){first=y;break;}if(first<0)continue;for(let dy=1;dy<=(id==='boots'?2:1);dy++){const to=((first-dy)*W+x)*4,from=(first*W+x)*4;for(let c=0;c<4;c++)result.data[to+c]=result.data[from+c];}}
      shoes[id].push(output(result));
    }
    const shoulderY=clothesTop+2,hips=waist+1,shoulderLeft=side?30:29,shoulderRight=side?48:50;
    const arms=[{pivot:[shoulderLeft,shoulderY],polygon:[[shoulderLeft-3,clothesTop],[shoulderLeft+3,clothesTop+1],[shoulderLeft+4,shoulderY+4],[shoulderLeft+2,waist+2],[left-1,waist+3],[left-2,shoulderY+6],[left,shoulderY+2]]},{pivot:[shoulderRight,shoulderY],polygon:[[shoulderRight-3,clothesTop],[shoulderRight+3,clothesTop],[left+width+2,shoulderY+3],[left+width+2,waist+3],[shoulderRight-2,waist+3],[shoulderRight-4,shoulderY+5]]}];
    metadata.rig.push({direction:directions[dir],neck:clothesTop,hipY:hips,split:anchor[0],arms,legs:[{pivot:[35,hips]},{pivot:[45,hips]}],nearArm:dir===2?0:1,nearLeg:dir===2?0:1,handArm:dir===0||dir===3?1:0,mirrored:false});
    metadata.frames.push({direction:directions[dir],source:crop,placement:[left,top],width,height,clothesTop,waist,shoeTop,bottom,groundStart:null,material:'gray-clothes',dyeRegions:{clothesTop,waist}});
  }
  return {body,original,outfit,shoes,metadata};
};
