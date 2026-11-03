'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const library=require('../decor-library.js'),meta=require('../scripts/lounge-assets.json');
const {alphaBounds,gridCells,fitRect,validateMetadata}=require('../scripts/build-lounge-assets.cjs');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the lounge expansion is twenty-four separate placeable assets with front-facing furniture and music artwork',()=>{
 const expected=[
  'rug-lounge-constellation','rug-lounge-sunset','rug-lounge-jade','clothes-rack-south','wardrobe-south','table-rectangle-south',
  'notes-register','notes-receipt-printer','notes-pen-cup','notes-ledger','notes-price-display','notes-display-tray',
  'wall-art-orbit','wall-art-equalizer','wall-art-keyboard','wall-art-sunset',
  'table-lounge-walnut','wall-art-treble-clef','wall-art-bass-clef','wall-art-grand-staff','wall-art-gold-record','wall-art-saxophone','wall-art-electric-guitars','wall-art-drum-kit'
 ];
 assert.deepEqual(validateMetadata(meta).ids,expected);
 assert.deepEqual(library.items.slice(55,79).map(item=>item.id),expected);
 assert.deepEqual(library.items.slice(55,79).reduce((counts,item)=>(counts[item.category]=(counts[item.category]||0)+1,counts),{}),{rug:3,furniture:4,tabletop:6,wall:11});
 assert.ok(library.items.slice(55,79).filter(item=>item.category==='tabletop').every(item=>item.width<=36&&item.height<=32),'Counter items stay small enough to arrange separately');
 assert.throws(()=>validateMetadata({...meta,sheets:[{...meta.sheets[0],ids:Array(6).fill(expected[0])}]}),/duplicate/);
 assert.throws(()=>validateMetadata({...meta,sheets:[{...meta.sheets[0],source:'published-world-project.json'}]}),/Invalid/);
});

test('sprite gutters preserve unequal silhouettes without cutting into a neighboring asset',()=>{
 const width=48,height=42,rgba=new Uint8ClampedArray(width*height*4),shapes=[[3,3,7,7],[21,3,4,7],[37,3,5,7],[2,25,10,11],[19,25,9,11],[35,25,9,11]];
 for(const[x,y,w,h]of shapes)for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)rgba[(yy*width+xx)*4+3]=255;
 const cells=gridCells(rgba,width,height,2,3);
 assert.equal(cells.length,6);
 for(let i=0;i<shapes.length;i++){
  const[x,y,w,h]=shapes[i],[cx,cy,cw,ch]=cells[i];
  assert.ok(x>=cx&&y>=cy&&x+w<=cx+cw&&y+h<=cy+ch,'The complete silhouette stays in its own sprite cell');
  for(let j=0;j<cells.length;j++)if(j!==i){const[a,b,c,d]=cells[j];assert.ok(x+w<=a||x>=a+c||y+h<=b||y>=b+d,'Neighbor cells never contain this artwork');}
 }
 assert.throws(()=>gridCells(new Uint8ClampedArray(width*height*4).fill(255),width,height,2,3),/transparent gutter/);
});

test('transparent bounds and normalization keep pixel art proportional with clear corners',()=>{
 const rgba=new Uint8ClampedArray(4*4*4);rgba[3]=8;rgba[(1*4+1)*4+3]=255;rgba[(3*4+2)*4+3]=200;
 assert.deepEqual(alphaBounds(rgba,4,4,8),[1,1,2,3]);
 assert.equal(alphaBounds(new Uint8ClampedArray(16),2,2),null);
 const[x,y,w,h]=fitRect(100,50,156,80);
 assert.ok(x>=2&&y>=2&&x+w<=154&&y+h<=78);
 assert.ok(Math.abs(w/h-2)<.03);
 assert.throws(()=>fitRect(0,50,156,80),/Invalid/);
});

test('all generated expansion cutouts retain transparent corners and reproducible source provenance',()=>{
 const report=JSON.parse(read(meta.manifest)),catalog=new Map(library.items.map(item=>[item.id,item]));
 assert.equal(report.version,1);assert.equal(report.items.length,24);assert.equal(report.sources.length,4);
 assert.deepEqual(report.items.map(item=>item.id),validateMetadata(meta).ids);
 for(const source of report.sources)assert.equal(sha(read(source.path)),source.sha256,'Generated sheets are retained without alteration');
 for(const record of report.items){
  const item=catalog.get(record.id),png=read(record.output);
  assert.equal(record.output,'assets/decor/v1/'+record.id+'.png');
  assert.equal(sha(png),record.sha256);
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[item.width,item.height]);
  assert.deepEqual(record.corners,[0,0,0,0]);
  const[x,y,w,h]=record.visibleBounds;
  assert.ok(w>4&&h>4&&x>=0&&y>=0&&x+w<=item.width&&y+h<=item.height);
  if(['furniture','wall'].includes(item.category))assert.ok(
   [x,y,item.width-x-w,item.height-y-h].every(gap=>gap<=4),
   'Keep furniture feet and wall-art selection bounds close to their visible silhouette: '+item.id);
  assert.ok(record.crop[2]>4&&record.crop[3]>4);
 }
});
