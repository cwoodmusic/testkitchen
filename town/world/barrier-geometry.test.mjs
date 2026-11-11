import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,height} from './model.mjs';
import {deriveBarrierRuns,deriveBarrierPosts,createBarrierGeometryCache,barrierRuns,barrierPosts,barrierRunBounds,barrierPostBounds} from './barrier-geometry.mjs';
import {intersectsViewport} from './render-visibility.mjs';
import {configureMusicWallArt} from './music-wall-art.mjs?v=room-editor-1';

const edge=(style='music-square',extra={})=>({style,gate:false,open:false,...extra});
function offsetMusic(){
 const d=blank();for(let i=0;i<5;i++)d.edges[`w:${100.5+i*64}:800.25:64:0`]=edge('music-square',{wallScale:.5});
 d.edges['w:420.5:800.25:0:64']=edge('music-square',{wallScale:.5});
 d.edges['w:420.5:864.25:0:64']=edge('music-square',{gate:true,wallScale:.5});return d;
}

test('run grouping preserves gaps, separate gates, source ordering and offset Music Square corners',()=>{
 const d=blank();for(const x of [1,2,3,5])d.edges[`h:${x}:2`]=edge('wood');d.edges['h:4:2']=edge('wood',{gate:true});
 assert.deepEqual(deriveBarrierRuns(d).map(r=>[r.start,r.end,r.axis,r.e.gate]),[[64,256,'h',false],[320,384,'h',false],[256,320,'h',true]]);
 const music=offsetMusic(),runs=deriveBarrierRuns(music),posts=deriveBarrierPosts(music,runs);
 assert.deepEqual(runs.map(r=>[r.start,r.end,r.axis,r.e.gate]),[[100.5,420.5,'h',false],[800.25,864.25,'v',false],[864.25,928.25,'v',true]]);
 assert.deepEqual(posts.map(p=>[p.x,p.y,p.gate]),[[100.5,800.25,false],[228.5,800.25,false],[356.5,800.25,false],[420.5,800.25,false],[420.5,864.25,true],[420.5,928.25,true]]);
 assert.deepEqual(barrierPosts(music,runs),posts,'Prepared runs must yield the same posts without deriving them again');
});

test('warm authoritative revisions never rescan edges and invalidate on edits, terrain replacement and Undo',()=>{
 let scans=0;const d=offsetMusic(),raw=d.edges;d.edges=new Proxy(raw,{ownKeys(target){scans++;return Reflect.ownKeys(target);}});
 const geometry=createBarrierGeometryCache(),first=geometry(d,{revision:1}),coldScans=scans;
 for(let i=0;i<1000;i++)assert.strictEqual(geometry(d,{revision:1}),first);
 assert.equal(scans,coldScans,'Unchanged walking frames must not enumerate or hash the edge collection');
 d.edges['w:100.5:800.25:64:0'].open=true;
 const opened=geometry(d,{revision:2});assert.notStrictEqual(opened,first);assert(opened.runItems.some(p=>p.run.e.open&&p.bounds===null));
 d.cells['1,12']={surface:'grass',level:4};const raised=geometry(d,{revision:3});assert(raised.runs.some(r=>r.z===192));assert(raised.posts.some(p=>p.x===100.5&&p.z===192));
 d.cells={};const undo=geometry(d,{revision:3});assert.notStrictEqual(undo,raised);assert(undo.runs.every(r=>r.z===0));
 d.edges={};assert.equal(geometry(d,{revision:3}).runs.length,0);
});

test('generic callers remain correct after direct gate, height and edge mutations without revision hints',()=>{
 const d=blank();d.edges['h:1:2']=edge('wood');const geometry=createBarrierGeometryCache();
 assert.equal(geometry(d).runs[0].z,0);
 d.cells['1,2']={surface:'grass',level:3};assert.equal(geometry(d).runs[0].z,144);
 d.cells['1,2'].level=5;assert.equal(geometry(d).posts[0].z,240);
 d.edges['h:1:2'].open=true;assert.equal(barrierRuns(d)[0].e.open,true);
 delete d.edges['h:1:2'];assert.equal(barrierPosts(d).length,0);assert.equal(geometry(d).runs.length,0);
});

test('barrier anchors follow exact sloped terrain samples when their revision changes',()=>{
 const d=blank();d.edges['h:1:2']=edge('limestone');d.cells['1,2']={surface:'grass',level:0,stairs:'north',stairBase:0,stairRise:2,stairStart:0,stairEnd:1};
 const geometry=createBarrierGeometryCache(),first=geometry(d,{revision:1});assert.equal(first.runs[0].z,height(d,66,130));assert.equal(first.posts[0].z,height(d,66,130));
 d.cells['1,2'].stairRise=4;const next=geometry(d,{revision:2});assert.notEqual(next.runs[0].z,first.runs[0].z);assert.equal(next.runs[0].z,height(d,66,130));
});

test('viewport bounds discard offscreen walls while retaining tall caps, scaled pillars, crossing runs and shadows',()=>{
 const d=blank();for(let i=0;i<1500;i++)d.edges[`h:${100+i%100}:${80+Math.floor(i/100)*2}`]=edge();
 const scene=createBarrierGeometryCache()(d,{revision:1}),view={x:0,y:0,w:1000,h:700};
 assert(scene.runs.length>0&&scene.posts.length>0);
 assert.equal(scene.runItems.filter(p=>p.bounds&&intersectsViewport(p.bounds,view)).length,0);
 assert.equal(scene.postItems.filter(p=>intersectsViewport(p.bounds,view)).length,0);
 const lowerView={x:300,y:500,w:300,h:100},post={x:400,y:900,z:0,e:edge('music-square',{wallScale:3})};
 assert(intersectsViewport(barrierPostBounds(post,d),lowerView),'A visible pillar cap must survive even when its anchor is far below the camera');
 const crossing={s:{x:0,y:600},e:edge('wood'),axis:'h',z:0,start:0,end:9000};
 assert(intersectsViewport(barrierRunBounds(crossing),{x:5000,y:470,w:300,h:100}),'A visible portion of a long run must survive');
 assert(intersectsViewport(barrierRunBounds(crossing),{x:300,y:608,w:300,h:3}),'Cast shadow extends below the ground anchor');
 assert.equal(barrierRunBounds({...crossing,e:edge('music-square',{open:true})}),null);
});

class DrawingContext{
 constructor(){this.matrix=[1,0,0,1,0,0];this.stack=[];this.rects=[];}
 save(){this.stack.push([...this.matrix]);}restore(){this.matrix=this.stack.pop();}
 transform(a,b,c,d,e,f){const[A,B,C,D,E,F]=this.matrix;this.matrix=[A*a+C*b,B*a+D*b,A*c+C*d,B*c+D*d,A*e+C*f+E,B*e+D*f+F];}
 translate(x,y){this.transform(1,0,0,1,x,y);}scale(x,y){this.transform(x,0,0,y,0,0);}rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);}
 rectangle(x,y,w,h){const[a,b,c,d,e,f]=this.matrix;this.rects.push([[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([X,Y])=>[a*X+c*Y+e,b*X+d*Y+f]));}
 fillRect(...args){this.rectangle(...args);}drawImage(...args){this.rectangle(...args.slice(-4));}
 beginPath(){}moveTo(){}lineTo(){}closePath(){}clip(){}
 getImageData(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4).fill(255)};}
}

test('culling bounds contain every actual draw rectangle for all styles, orientations, scales and gate states',async()=>{
 const previousImage=globalThis.Image,previousDocument=globalThis.document;
 globalThis.Image=class{constructor(){this.width=160;this.height=120;}set src(value){queueMicrotask(()=>this.onload());}};
 globalThis.document={createElement:()=>({width:1,height:1,getContext:()=>new DrawingContext()})};
 try{
  const {drawBarrierRun,drawPost}=await import('./construction.mjs?v=room-editor-1'),d=blank();
  configureMusicWallArt({width:1536,height:1024},{width:300,height:300});
  const check=(context,bounds,label)=>{
   for(const rect of context.rects)for(const[x,y]of rect)assert(bounds&&x>=bounds.x-1e-6&&x<=bounds.x+bounds.w+1e-6&&y>=bounds.y-1e-6&&y<=bounds.y+bounds.h+1e-6,label+': culling must contain '+x+','+y);
  };
  for(const style of ['wood','rail','iron','limestone','brick','plaster','music-square'])for(const axis of ['h','v'])for(const scale of [.25,1,3])for(const gate of [false,true])for(const open of [false,true]){
   const e=edge(style,{gate,open,wallScale:scale}),run={s:{x:1000,y:2000},e,z:384,axis,start:axis==='h'?1000:2000,end:(axis==='h'?1000:2000)+768},c=new DrawingContext();
   drawBarrierRun(c,run);check(c,barrierRunBounds(run),`${style}/${axis}/${scale}/${gate}/${open}`);
   const p={x:1000,y:2000,z:384,e,gate},post=new DrawingContext();drawPost(post,p,d);check(post,barrierPostBounds(p,d),'post '+style+'/'+scale+'/'+gate);
  }
 }finally{globalThis.Image=previousImage;globalThis.document=previousDocument;}
});
