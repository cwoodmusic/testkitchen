/* Browser-safe native-pixel wardrobe extraction. Serialized into the atlas baker.
 * Garment variants copy the old hero's shirt, trousers, outlines and shoes; they
 * never import a new character, rescale a plate or draw a replacement face. */
module.exports=function buildOriginalWardrobeLayers(options){
  'use strict';
  const atlas=options.atlas,cell=options.cell||[80,96],anchor=options.anchor||[40,88];
  const W=cell[0],H=cell[1],directions=['down','left','up','right'];
  const requested=Math.max(0,Math.min(4,Math.round(Number.isFinite(options.frameIndex)?options.frameIndex:0)));
  const defaults={down:{x:16,y:5,w:47,h:69},left:{x:816,y:5,w:47,h:69},up:{x:416,y:6,w:47,h:67},right:{x:256,y:85,w:47,h:69}};
  const frames=directions.map((direction,index)=>options.heroFrames?.['hero_'+direction+'_'+requested]||options.heroFrames?.[direction]?.[requested]||options.heroFrames?.[direction]||options.heroFrames?.[index]||defaults[direction]);
  const faceEnds=[42,35,41,29];
  const make=()=>{const value=document.createElement('canvas');value.width=W;value.height=H;return value;};
  const context=value=>value.getContext('2d',{willReadFrequently:true});
  const output=pixels=>{const value=make();context(value).putImageData(pixels,0,0);return value;};
  const hsv=(r,g,b)=>{const hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo;let h=delta?hi===r?((g-b)/delta)%6:hi===g?(b-r)/delta+2:(r-g)/delta+4:0;return {h:(h*60+360)%360,s:hi?delta/hi:0,v:hi/255};};
  const rgb=(h,s,v)=>{const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return parts.map(value=>Math.round((value+m)*255));};
  const skin=(r,g,b)=>{const c=hsv(r,g,b);return c.h>=8&&c.h<=65&&c.s>=.2&&c.v>=.15||r>g*1.13&&g>b*1.15&&g>45&&r<g*1.9;};
  const outfit=Object.fromEntries(['pants','shorts','dress','overalls','suit','coat'].map(id=>[id,[]]));
  const shoes=Object.fromEntries(['sneakers','boots','hightops','neon','gold'].map(id=>[id,[]]));
  const metadata={source:'coda_arcade_phase73_characters.png',method:'native hero garment and footwear pixels',cell:cell.slice(),anchor:anchor.slice(),directions,frameIndex:requested,materials:{pants:'original-clothes',shorts:'clothes',dress:'clothes',overalls:'clothes',suit:'clothes',coat:'clothes'},skinMaterialHue:[85,145],frames:[]};
  for(let dir=0;dir<4;dir++){
    const source=make(),g=context(source),frame=frames[dir],left=Math.round(anchor[0]-frame.w/2),top=anchor[1]-frame.h;
    g.imageSmoothingEnabled=false;g.drawImage(atlas,frame.x,frame.y,frame.w,frame.h,left,top,frame.w,frame.h);
    const raw=g.getImageData(0,0,W,H),data=raw.data,seen=new Uint8Array(W*H);let body=[],groundStart=null;
    // Several old profile crops include the sheet's opaque blue divider. It
    // spans the whole crop below the feet and can be connected through black
    // pixels, so alpha-component extraction alone does not separate it.
    for(let localY=Math.max(0,frame.h-10);localY<frame.h;localY++){
      const y=top+localY;let count=0;for(let x=left;x<left+frame.w;x++)if(data[(y*W+x)*4+3])count++;
      if(count>=frame.w*.92&&data[(y*W+left)*4+3]&&data[(y*W+left+frame.w-1)*4+3]){groundStart=y;break;}
    }
    if(groundStart!==null)for(let y=groundStart;y<H;y++)for(let x=0;x<W;x++)data[(y*W+x)*4+3]=0;
    // Ignore the old atlas' disconnected blue divider/ground pixels. Clothing
    // and shoes belong to the same connected silhouette as the hero's face.
    for(let seed=0;seed<W*H;seed++)if(data[seed*4+3]&&!seen[seed]){
      const queue=[seed];seen[seed]=1;
      for(let at=0;at<queue.length;at++){const id=queue[at],x=id%W,y=Math.floor(id/W);for(let yy=Math.max(0,y-1);yy<=Math.min(H-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(W-1,x+1);xx++){const next=yy*W+xx;if(data[next*4+3]&&!seen[next]){seen[next]=1;queue.push(next);}}}
      if(queue.length>body.length)body=queue;
    }
    if(!body.length)throw Error('Original hero frame is empty: '+directions[dir]+' '+requested);
    const bodyMask=new Uint8Array(W*H);for(const id of body)bodyMask[id]=1;
    const bottom=Math.max(...body.map(id=>Math.floor(id/W))),shoeTop=bottom-4,clothesTop=top+(frame.faceEnd??faceEnds[dir])+1,waist=Math.max(clothesTop+3,shoeTop-10);
    const original=g.createImageData(W,H),canonical=g.createImageData(W,H),upper=[],lower=[],ink=[],legPixels=[];
    const copyPixel=(target,to,from,role)=>{
      target[to+3]=data[from+3];let values=[data[from],data[from+1],data[from+2]],c=hsv(...values);
      if(role&&c.v>=.15&&c.s>=.12){const hue=role==='upper'?300:role==='lower'?220:115;values=rgb(hue,role==='skin'?Math.max(.42,Math.min(.65,c.s)):c.s,c.v);}
      for(let channel=0;channel<3;channel++)target[to+channel]=values[channel];
    };
    for(let y=clothesTop;y<shoeTop;y++)for(let x=0;x<W;x++){
      const index=y*W+x,at=index*4;if(!bodyMask[index]||skin(data[at],data[at+1],data[at+2]))continue;
      const c=hsv(data[at],data[at+1],data[at+2]);
      const role=c.s>=.12&&c.v>=.15?(c.h<=25||c.h>=330?'upper':c.h>=175&&c.h<=270?'lower':null):null;
      copyPixel(original.data,at,at);copyPixel(canonical.data,at,at,role);
      if(role==='upper'&&y<waist+1)upper.push({x,y,at});if(role==='lower')lower.push({x,y,at});if(c.v<.2)ink.push({x,y,at});
      if(y>=waist&&x>=anchor[0]-14&&x<=anchor[0]+14)legPixels.push({x,y,at,role,c});
    }
    if(!upper.length||!lower.length)throw Error('Cannot identify original shirt/trousers: '+directions[dir]+' '+requested);
    const duplicate=pixels=>new ImageData(new Uint8ClampedArray(pixels.data),W,H);
    const nearest=(samples,x,y)=>{let chosen=samples[0],best=Infinity;for(const value of samples){const distance=Math.abs(value.x-x)+Math.abs(value.y-y)*.7;if(distance<best){best=distance;chosen=value;}}return chosen;};
    const clone=(target,x,y,role,edge=false)=>{if(x<0||x>=W||y<clothesTop||y>=shoeTop)return;const samples=edge&&ink.length?ink:role==='lower'?lower:upper,chosen=nearest(samples,x,y);copyPixel(target.data,(y*W+x)*4,chosen.at,edge?null:role);};
    outfit.pants.push(output(original));
    const shorts=duplicate(canonical);
    for(const p of legPixels)if(p.y>=shoeTop-6&&p.role==='lower')copyPixel(shorts.data,p.at,p.at,'skin');
    outfit.shorts.push(output(shorts));
    const overalls=duplicate(canonical);
    for(let y=clothesTop+3;y<waist+1;y++)for(let x=anchor[0]-5;x<=anchor[0]+5;x++){
      const at=(y*W+x)*4,c=hsv(data[at],data[at+1],data[at+2]);
      if(canonical.data[at+3]&&c.v>=.15&&c.s>=.12&&!skin(data[at],data[at+1],data[at+2]))clone(overalls,x,y,'lower');
    }
    outfit.overalls.push(output(overalls));
    const suit=duplicate(canonical);
    for(let y=clothesTop;y<waist;y++)for(let x=0;x<W;x++){
      const at=(y*W+x)*4,c=hsv(data[at],data[at+1],data[at+2]);
      if(suit.data[at+3]&&c.h>=175&&c.h<=270&&c.s>=.12&&c.v>=.15)clone(suit,x,y,'upper');
    }
    // Narrow native ink/braces become jacket lapels. White collar pixels and
    // the old pixel highlights are retained; there is no newly painted face.
    if(dir!==2)for(let y=clothesTop+2;y<Math.min(waist,clothesTop+9);y++)for(const x of [anchor[0]-4,anchor[0]+3])if(suit.data[(y*W+x)*4+3])clone(suit,x,y,'upper',true);
    outfit.suit.push(output(suit));
    const dress=duplicate(canonical),side=dir%2,half=side?7:10;
    for(let y=waist;y<shoeTop;y++){
      const row=legPixels.filter(p=>p.y===y).map(p=>p.x),flare=Math.floor((y-waist)/3);
      const lo=Math.min(anchor[0]-half-flare,...row),hi=Math.max(anchor[0]+half+flare,...row);
      for(let x=lo;x<=hi;x++)clone(dress,x,y,'upper',x===lo||x===hi||y===shoeTop-1);
    }
    outfit.dress.push(output(dress));
    const coat=duplicate(suit),legXs=legPixels.filter(p=>p.role==='lower').map(p=>p.x),lo=Math.max(0,(legXs.length?Math.min(...legXs):anchor[0]-7)-2),hi=Math.min(W-1,(legXs.length?Math.max(...legXs):anchor[0]+7)+2);
    for(let y=waist-1;y<shoeTop-1;y++)for(let x=lo;x<=hi;x++)if(x<anchor[0]-2||x>anchor[0]+2)clone(coat,x,y,'upper',x===lo||x===hi||y===shoeTop-2);
    outfit.coat.push(output(coat));
    const nativeShoe=g.createImageData(W,H);
    for(let y=shoeTop;y<=bottom;y++)for(let x=0;x<W;x++){const at=(y*W+x)*4;if(bodyMask[y*W+x])copyPixel(nativeShoe.data,at,at);}
    for(const id of Object.keys(shoes)){
      const result=duplicate(nativeShoe),target={boots:[25,.48],hightops:[325,.46],neon:[165,.64],gold:[43,.72]}[id];
      if(target)for(let at=0;at<result.data.length;at+=4){if(!result.data[at+3])continue;const c=hsv(result.data[at],result.data[at+1],result.data[at+2]);if(c.v<.18||c.s<.12&&c.v>.85)continue;const values=rgb(target[0],target[1],c.v);for(let channel=0;channel<3;channel++)result.data[at+channel]=values[channel];}
      if(id==='boots'||id==='hightops'){
        // A higher ankle repeats each actual shoe's existing top pixels. The
        // old sole and stride positions remain exactly where the source put them.
        const height=id==='boots'?2:1;
        for(let x=0;x<W;x++){let first=-1;for(let y=shoeTop;y<=bottom;y++)if(result.data[(y*W+x)*4+3]){first=y;break;}if(first<0)continue;for(let step=1;step<=height;step++){const to=((first-step)*W+x)*4,from=(first*W+x)*4;for(let channel=0;channel<4;channel++)result.data[to+channel]=result.data[from+channel];}}
      }
      shoes[id].push(output(result));
    }
    metadata.frames.push({direction:directions[dir],source:{x:frame.x,y:frame.y,w:frame.w,h:frame.h},placement:[left,top],clothesTop,waist,shoeTop,bottom,groundStart});
  }
  return {outfit,shoes,metadata};
};
