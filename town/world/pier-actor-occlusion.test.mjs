import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {blank,actorHeight} from './model.mjs';
import {drawPierOccludedActor,pierActorOcclusionStats,pierActorOcclusionRects} from './pier-actor-occlusion.mjs';
import {drawRhythmNet} from './rhythm-net-render.mjs';
import {pierGeometry,drawPier} from './piers.mjs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
const color=(c,x,y)=>[...c.getImageData(x,y,1,1).data];
function fixture({single=false}={}){
 const doc=blank();for(let y=single?10:8;y<=(single?10:20);y++)for(let x=10;x<=(single?10:12);x++)doc.cells[x+','+y]={surface:'sand',level:0,bridge:'ns',pier:{level:8,axis:'ns'}};
 const canvas=createCanvas(1000,1100),c=canvas.getContext('2d');c.fillStyle='#112233';c.fillRect(0,0,1000,1100);return {doc,canvas,c};
}
const paint=rect=>c=>{c.fillStyle='#ff0000';c.fillRect(rect.x,rect.y,rect.w,rect.h);};

test('the inexpensive pier mask exactly matches native deck and timber alpha in every support arrangement',async()=>{
 const image=await loadImage(new URL('../assets/ground-surfaces.png',import.meta.url).pathname),source=createCanvas(image.width,image.height),native=source.getContext('2d');native.drawImage(image,0,0);
 const woodPanel=native.getImageData(image.width*2/3,0,image.width/3,image.height).data;
 for(let n=3;n<woodPanel.length;n+=4)assert.equal(woodPanel[n],255,'The native wood field remains opaque');
 const wood=createCanvas(512,512),wg=wood.getContext('2d');wg.drawImage(image,image.width*2/3,0,image.width/3,image.height,0,0,512,512);
 let checked=0;
 for(const axis of ['ns','ew'])for(const surface of ['sand','water'])for(const ground of [0,7,8])for(const shape of ['isolated','joined','west-edge','odd-interior']){
  const doc=blank(),x=10,y=shape==='odd-interior'?11:10,deck=8;
  doc.cells[x+','+y]={surface,level:ground,bridge:axis,pier:{level:deck,axis}};
  const neighbors=shape==='isolated'?[]:shape==='west-edge'?[[0,-1],[0,1],[1,0]]:[[0,-1],[0,1],[-1,0],[1,0]];
  for(const [dx,dy]of neighbors)doc.cells[(x+dx)+','+(y+dy)]={surface,level:ground,bridge:axis,pier:{level:deck,axis}};
  const geometry=pierGeometry(doc,x,y),origin={x:x*64-32,y:y*64-384-32};
  for(const afterY of [-Infinity,y*64+55,y*64+57]){
   const expected=createCanvas(128,640),e=expected.getContext('2d'),actual=createCanvas(128,640),a=actual.getContext('2d');
   for(const c of [e,a])c.setTransform(1,0,0,1,-origin.x,-origin.y);
   drawPier(e,doc,x,y,wood,{afterY});a.fillStyle='#fff';
   for(const rect of pierActorOcclusionRects(geometry,afterY)){a.globalAlpha=rect.alpha??1;a.fillRect(rect.x,rect.y,rect.w,rect.h);}
   const ep=e.getImageData(0,0,128,640).data,ap=a.getImageData(0,0,128,640).data;
   for(let n=3;n<ep.length;n+=4)assert.equal(ap[n],ep[n],`${axis}/${surface}/${ground}/${shape}/${afterY}: alpha pixel ${(n-3)/4}`);
   checked++;
  }
 }
 assert.equal(checked,144);
});

test('an overhead deck hides only the covered part of a lower actor and leaves neighboring object pixels untouched',()=>{
 const {doc,c}=fixture(),raw=JSON.stringify(doc),actor={x:650,y:864,underPier:true};
 c.fillStyle='#ffffff';c.fillRect(680,800,20,20);
 assert(drawPierOccludedActor(c,doc,actor,paint({x:625,y:784,w:50,h:80}),null,{createCanvas}));
 assert.deepEqual(color(c,630,810),[255,0,0,255],'The part outside the overhead deck remains visible');
 assert.deepEqual(color(c,660,810),[17,34,51,255],'Only the actor ink behind the deck is removed');
 assert.deepEqual(color(c,685,810),[255,255,255,255],'Masking never repaints a neighboring actor or object');
 assert.equal(JSON.stringify(doc),raw);assert.equal(actorHeight(doc,actor),0);
});

test('top-deck actors keep the original direct drawing path and allocate no masking canvases',()=>{
 const {doc,c}=fixture(),expected=createCanvas(1000,1100),e=expected.getContext('2d');e.fillStyle='#112233';e.fillRect(0,0,1000,1100);
 const actor={x:650,y:864},draw=paint({x:625,y:400,w:50,h:80});draw(e);
 assert.equal(drawPierOccludedActor(c,doc,actor,draw,null,{createCanvas}),false);
 assert.deepEqual(c.getImageData(0,0,1000,1100).data,e.getImageData(0,0,1000,1100).data);
 assert.equal(pierActorOcclusionStats(c),null);
});

test('a timber in front occludes the lower actor while the same timber behind their feet stays behind',()=>{
 const front=fixture({single:true}),actor={x:676,y:670,underPier:true};
 drawPierOccludedActor(front.c,front.doc,actor,paint({x:646,y:590,w:60,h:80}),null,{createCanvas});
 assert.deepEqual(color(front.c,651,640),[17,34,51,255]);
 const behind=fixture({single:true}),closer={x:676,y:700,underPier:true};
 drawPierOccludedActor(behind.c,behind.doc,closer,paint({x:646,y:620,w:60,h:80}),null,{createCanvas});
 assert.deepEqual(color(behind.c,651,650),[255,0,0,255]);
});

test('under-deck compositing reuses a bounded pair of buffers through movement',()=>{
 const {doc,c}=fixture(),actor={x:650,y:864,underPier:true};let allocations=0;
 const make=(w,h)=>{allocations++;return createCanvas(w,h);};
 for(let n=0;n<120;n++){actor.x=650+n%5;drawPierOccludedActor(c,doc,actor,paint({x:actor.x-25,y:784,w:50,h:80}),null,{createCanvas:make});}
 const stats=pierActorOcclusionStats(c);assert.equal(allocations,2);assert.equal(stats.frames,120);assert.equal(stats.pixels,393216);assert(stats.tiles<120*100);
});

test('all real net swing directions retain unoccluded hoop and mesh ink beyond the body bounds',()=>{
 const doc=blank();doc.cells['5,7']={surface:'sand',level:0,bridge:'ns',pier:{level:8,axis:'ns'}};
 const actor={x:352,y:480,underPier:true},angles=[0,Math.PI/2,Math.PI,Math.PI*1.5],ages=[Infinity,0,.12,.2,.35,.4,.45,.47,.49,.495,.55,.68];
 let verifiedInk=0;
 for(const angle of angles)for(const age of ages){
  const plain=createCanvas(720,760),expected=plain.getContext('2d'),masked=createCanvas(720,760),actual=masked.getContext('2d'),unclipped=createCanvas(720,760),reference=unclipped.getContext('2d');
  const draw=c=>drawRhythmNet(c,actor,{angle,age,z:0,swinging:age<.5});
  // A complete native tool raster with the same world origin is the reference;
  // its larger canvas has no actor-sized clipping or pier subtraction.
  reference.setTransform(1,0,0,1,-160,-160);draw(reference);expected.imageSmoothingEnabled=false;expected.drawImage(unclipped,160,160);
  drawPierOccludedActor(actual,doc,actor,draw,null,{createCanvas});
  const a=actual.getImageData(0,0,720,760).data,b=expected.getImageData(0,0,720,760).data;
  // The one physical pier is320..384px wide and ends at its front post507px.
  // Every pixel outside that silhouette must retain the complete native net.
  for(let y=0;y<760;y++)for(let x=0;x<720;x++)if(x<320||x>=384||y>510){const at=(y*720+x)*4;if(!b[at+3])continue;verifiedInk++;for(let n=0;n<4;n++)assert.equal(a[at+n],b[at+n],`${angle}/${age}: unoccluded native net at ${x},${y}`);}
 }
 assert(verifiedInk>10000,'The proof must include actual hoop, trailing mesh and the downswing outside the old body envelope');
});
