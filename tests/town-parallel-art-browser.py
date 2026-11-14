"""Check accepted native replacements against real catalog, renderer and exports.

The baseline context disables only the new art-data module. Existing physical
and cardinal metadata are compared with the production context. No map, room
factory, source image or user storage is changed.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse
import argparse
import base64
import hashlib
import json

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'work/parallel-projection/browser')
parser.add_argument('--allow-empty', action='store_true', help='Infrastructure preflight before accepted art is populated')
parser.add_argument('--expected-arcades', type=int, default=31, help='Expected declared arcade screen geometry corrections')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def copyfile(self, source, target):
        try:
            super().copyfile(source, target)
        except (BrokenPipeError, ConnectionResetError):
            pass


SNAPSHOT = '''() => {
 const c=townAssetReview.catalog,fields=['id','name','group','w','h','boxes','polygons','layer','owner','collectionOwner','apartmentCollection','slot','purpose','furnitureRole','style','pack','variant','aliasOf','sourceAssetId','price','wallMounted','collisionDefault','npcAvoid','depthSorted','seats','fixedScale','footprint','door','mountDefault','furnitureFacing'];
 return [...c.values()].map(a=>{
  const physical={};for(const field of fields)if(a[field]!==undefined)physical[field]=a[field];
  const views={};if(typeof a.getFacingView==='function')for(const facing of ['south','west','north','east']){
   const v=a.getFacingView(facing,{image:false});if(v)views[facing]={id:v.id,w:v.w,h:v.h,footCenter:v.footCenter,facing:v.facing,relativeFacing:v.relativeFacing,motion:v.motion};
  }
  return {id:a.id,physical,motion:a.motion,views};
 });
}'''


def assert_motion_metadata(before, after, patches):
    """Keep every physical field and every undeclared motion field immutable."""
    declared = {(p['id'], p.get('facing', 'south')): p['motionGeometry']
                for p in patches if 'motionGeometry' in p}
    assert [r['id'] for r in before] == [r['id'] for r in after], 'Catalog IDs changed'
    checked = []

    def motion(old, new, geometry, key):
        if geometry is None:
            assert old == new, ('Undeclared motion change', key)
            return
        assert isinstance(old, dict) and isinstance(new, dict), ('Missing original/new motion', key)
        retained = lambda value: {k: v for k, v in value.items() if k not in {'mask', 'bounds'}}
        assert retained(old) == retained(new), ('Motion game, seed, palette or kind changed', key)
        assert new.get('mask') == geometry['mask'], ('Screen mask differs from its declaration', key)
        xs, ys = zip(*geometry['mask'])
        bounds = geometry.get('bounds', [min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)])
        assert len(new.get('bounds', [])) == 4 and all(abs(a - b) <= 1e-9 for a, b in zip(new['bounds'], bounds)), ('Screen bounds differ from declaration', key)
        checked.append(key)

    for old, new in zip(before, after):
        ident = old['id']
        assert old['physical'] == new['physical'], ('Physical dimensions, ownership or collision changed', ident)
        assert old['views'].keys() == new['views'].keys(), ('Cardinal views changed', ident)
        for facing, old_view in old['views'].items():
            new_view = new['views'][facing]
            assert {k: v for k, v in old_view.items() if k != 'motion'} == {k: v for k, v in new_view.items() if k != 'motion'}, ('View size or ground anchor changed', ident, facing)
            geometry = declared.get((ident, facing))
            original = old_view.get('motion')
            if geometry is not None and original is None and facing == 'south':
                original = old.get('motion')
            motion(original, new_view.get('motion'), geometry, (ident, facing))
        geometry = declared.get((ident, 'south'))
        original = old.get('motion')
        if geometry is not None and original is None:
            original = old['views'].get('south', {}).get('motion')
        motion(original, new.get('motion'), geometry, (ident, 'asset'))
    return {'declaredViews': len(declared), 'geometryChecks': len(checked), 'allOtherMotionFieldsUnchanged': True}


MOTION_PROBE = '''async ({expectedArcades,baseline}) => {
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 check(!matchMedia('(prefers-reduced-motion: reduce)').matches,'Animation checks require normal motion');
 const app=new URL(document.querySelector('script[type="module"]').src),module=path=>import(performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===path).at(-1)?.name??path+app.search);
 const {catalog,parallelArtRuntime:runtime}=await module('/town/world/catalog.mjs'),{PARALLEL_ART_PATCHES:patches}=await module('/town/world/parallel-art-data.mjs');
 const {drawObject}=await module('/town/world/render.mjs'),{furnitureFacingPlacement,facingRotation}=await module('/town/world/furniture-facing.mjs');
 const {drawFurnitureFacingSource}=await module('/town/world/furniture-facing-source.mjs'),{assetFilter}=await module('/town/world/asset-color.mjs');
 const originals=new Map(baseline.map(row=>[row.id,row]));
 const retainedMotion=m=>JSON.stringify(Object.fromEntries(Object.entries(m).filter(([key])=>key!=='mask'&&key!=='bounds').sort(([a],[b])=>a.localeCompare(b))));
 const selected=patches.filter(p=>p.motionGeometry&&((originals.get(p.id)?.views?.[p.facing??'south']?.motion??originals.get(p.id)?.motion)?.kind==='arcade'));
 check(selected.length===expectedArcades,'Expected '+expectedArcades+' corrected arcade screens; found '+selected.length);
 const make=(w,h)=>{const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;},pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 const rows=[];
 for(const patch of selected){
  const a=catalog.get(patch.id),facing=patch.facing??'south';await a.ensureFull(facing);const view=a.getFacingView(facing,{image:false}),motion=view.motion;
  check(motion&&motion.kind==='arcade'&&JSON.stringify(motion.mask)===JSON.stringify(patch.motionGeometry.mask),'Edited geometry not active '+a.id);
  const original=originals.get(a.id),oldMotion=original.views[facing]?.motion??original.motion;check(retainedMotion(motion)===retainedMotion(oldMotion),'Arcade kind, game, seed or palette changed '+a.id);
  if(facing==='south')check(a.motion===motion,'Asset/view motion disagree '+a.id);
  const scale=4,w=view.w,h=view.h,object={id:'arcade-motion-check',asset:a.id,x:512,y:512,scale:1,rotation:facingRotation(facing),layer:a.layer,collision:false},pose={x:512,y:512,offset:1},placement=furnitureFacingPlacement(a,object,pose,{includeImage:false});
  check(placement,'Missing animated furniture placement '+a.id);
  const base=make(w*scale,h*scale),B=base.getContext('2d');B.scale(scale,scale);B.translate(-placement.x,-placement.y);B.filter=assetFilter(a);drawFurnitureFacingSource(B,placement,a.getFacingDrawSource(facing,{native:true}));const still=pixels(base);
  // Browser raster coverage includes only pixels touched by the declared
  // glass polygon, including its antialiased edge. No casing pixel qualifies.
  const allowed=make(w*scale,h*scale),G=allowed.getContext('2d');G.scale(scale,scale);G.beginPath();motion.mask.forEach(([u,v],i)=>G[i?'lineTo':'moveTo'](u*w,v*h));G.closePath();G.fill();const glass=pixels(allowed);
  let painted=0,outside=0,moving=0,first=null;
  for(const time of [.125,.5,1.25,2.75,7.5]){
   const frame=make(w*scale,h*scale),F=frame.getContext('2d');F.scale(scale,scale);F.translate(-placement.x,-placement.y);drawObject(F,object,{cells:{},edges:{},objects:[object]},false,1,time,null,{pose,facing:placement,native:true});const now=pixels(frame);
   let changed=0,leaked=0;for(let at=0;at<now.length;at+=4){if(now[at]!==still[at]||now[at+1]!==still[at+1]||now[at+2]!==still[at+2]||now[at+3]!==still[at+3]){changed++;if(!glass[at+3])leaked++;}if(first&&(now[at]!==first[at]||now[at+1]!==first[at+1]||now[at+2]!==first[at+2]||now[at+3]!==first[at+3]))moving++;}
   painted=Math.max(painted,changed);outside+=leaked;
   if(leaked){window.__parallelMotionDebug={id:a.id,facing,time,leaked,mask:motion.mask,base:base.toDataURL(),frame:frame.toDataURL(),allowed:allowed.toDataURL()};throw Error(a.id+' animation changes '+leaked+' pixels outside its declared inner glass');}
   first??=now;frame.width=frame.height=1;
  }
  check(painted>8&&moving>3,'No visible moving arcade game '+a.id);rows.push({id:a.id,facing,paintedPixels:painted,movingPixels:moving,outsideGlassPixels:outside,mask:motion.mask});base.width=base.height=allowed.width=allowed.height=1;
 }
 return {views:rows.length,rows};
}'''

MOTION_FALLBACK_PROBE = '''async ({baseline,expectedArcades}) => {
 const check=(ok,message)=>{if(!ok)throw Error(message);},app=new URL(document.querySelector('script[type="module"]').src),module=path=>import(performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===path).at(-1)?.name??path+app.search);
 const {catalog,parallelArtRuntime:runtime}=await module('/town/world/catalog.mjs'),{PARALLEL_ART_PATCHES:patches}=await module('/town/world/parallel-art-data.mjs'),originals=new Map(baseline.map(row=>[row.id,row]));
 const selected=patches.filter(p=>p.motionGeometry&&((originals.get(p.id)?.views?.[p.facing??'south']?.motion??originals.get(p.id)?.motion)?.kind==='arcade'));check(selected.length===expectedArcades,'Missing corrected arcade fallback cases');
 runtime.clear();await runtime.warmPreviews().catch(()=>{});let failures=0;
 for(const patch of selected){
  const a=catalog.get(patch.id),f=patch.facing??'south',original=originals.get(a.id),oldView=original.views[f]?.motion??(f==='south'?original.motion:null);
  try{await a.ensureFull(f);}catch{failures++;}
  check(JSON.stringify(a.getFacingView(f,{image:false}).motion)===JSON.stringify(oldView),'Failed edited art retained new screen geometry '+a.id);
  if(f==='south')check(JSON.stringify(a.motion)===JSON.stringify(original.motion??oldView),'Failed edited art changed original asset motion '+a.id);
  // Touch the real legacy fallback paths too, so their dynamic South getter
  // cannot silently make edited geometry reappear while old art is visible.
  a.getFacingImage(f);a.getFacingDrawSource(f,{native:true});
  check(JSON.stringify(a.getFacingView(f,{image:false}).motion)===JSON.stringify(oldView),'Fallback image activated edited geometry '+a.id);
 }
 check(failures===selected.length,'Edited native failure probe did not reject every target');return {views:selected.length,failedNativeLoads:failures,originalGeometryRetained:true,runtime:runtime.stats};
}'''

PROBE = '''async ({allowEmpty}) => {
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const app=new URL(document.querySelector('script[type="module"]').src);
 const appModule=path=>{
  const loaded=performance.getEntriesByType('resource').filter(entry=>new URL(entry.name).pathname===path).at(-1);
  return import(loaded?.name??path+app.search);
 };
 const {catalog,parallelArtRuntime:runtime}=await appModule('/town/world/catalog.mjs');
 const {PARALLEL_ART_PATCHES:patches}=await appModule('/town/world/parallel-art-data.mjs');
 const reviewClones=new Set(['construction-3','construction-4','construction-5','music-square-wall']),patchedIds=new Set(patches.map(p=>p.id));
 const canvasGetter=a=>{for(let at=a;at;at=Object.getPrototypeOf(at)){const d=Object.getOwnPropertyDescriptor(at,'canvas');if(d)return d.get??d.value;}return undefined;};
 for(const [id,a]of catalog){
  const reviewed=townAssetReview.catalog.get(id);if(reviewed===a)continue;
  check(reviewClones.has(id)&&!patchedIds.has(id),'Test must exercise the actual shared game object '+id);
  for(const key of ['w','h','boxes','polygons','layer','owner','footprint','door','wallMounted','collisionDefault','npcAvoid','depthSorted'])check(JSON.stringify(reviewed[key])===JSON.stringify(a[key]),'Review-only clone changed physical metadata '+id+'/'+key);
  for(const key of ['draw','getFacingView','getFacingImage','getFacingDrawSource','ensureFull'])check(reviewed[key]===a[key],'Review-only clone changed native art API '+id+'/'+key);
  check(canvasGetter(reviewed)===canvasGetter(a),'Review-only clone changed its native canvas '+id);
 }
 const {prepareAssetPreview}=await appModule('/town/asset-review/preview.mjs');
 const {assetFilter}=await appModule('/town/world/asset-color.mjs');
 const {drawObject}=await appModule('/town/world/render.mjs');
 const {furnitureFacingPlacement,facingRotation,supportsFurnitureFacing}=await appModule('/town/world/furniture-facing.mjs');
 const {drawFurnitureFacingSource,flatFurnitureFacingPlacement,flatFurnitureFacingLocalPlacement}=await appModule('/town/world/furniture-facing-source.mjs');
 const {spriteBounds}=await appModule('/town/world/render-visibility.mjs');
 check(allowEmpty||patches.length>0,'No accepted native replacement art is registered');
 const make=(w,h)=>{const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);const g=c.getContext('2d');g.imageSmoothingEnabled=false;return [c,g];};
 const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 const digest=async p=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',p))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const compare=(a,b,label)=>{const A=pixels(a),B=pixels(b);check(A.length===B.length,label+' dimensions');let changed=0,max=0;for(let i=0;i<A.length;i++){const d=Math.abs(A[i]-B[i]);if(d){changed++;max=Math.max(max,d);}}check(!changed,label+' changed '+changed+' channels; max difference '+max);};
 const draw=(g,s)=>g.drawImage(s.image,s.sx??0,s.sy??0,s.sw,s.sh,s.dx??0,s.dy??0,s.dw,s.dh);
 const referenceImages=new Map();
 async function reference(file){
  if(referenceImages.has(file))return referenceImages.get(file);
  const im=await new Promise((resolve,reject)=>{const i=new Image();i.onload=async()=>{try{await i.decode();resolve(i);}catch(e){reject(e);}};i.onerror=()=>reject(Error('Reference art failed '+file));i.src='/town/assets/parallel-art/'+file;});
  // Keep this independent verification cache bounded as well.
  if(referenceImages.size>=2)referenceImages.delete(referenceImages.keys().next().value);referenceImages.set(file,im);return im;
 }
 const assertBudget=()=>{const s=runtime.stats;check(s.sourceEntries<=s.maxSources&&s.sourcePixels<=s.maxSourcePixels,'Native source LRU overflow');check(s.canvasEntries<=s.maxCanvases&&s.canvasPixels<=s.maxCanvasPixels,'Native/compatibility canvas LRU overflow');check(s.previewEntries<=s.maxPreviewSources&&s.previewPixels<=s.maxPreviewPixels,'Compact preview LRU overflow');check(s.activeLoads<=s.maxConcurrentLoads,'Concurrent image decode overflow');};
 const beforeMetadata=runtime.stats;
 for(let pass=0;pass<3;pass++)for(const a of catalog.values())if(typeof a.getFacingView==='function')for(const facing of ['south','west','north','east'])a.getFacingView(facing,{image:false});
 const afterMetadata=runtime.stats;
 for(const key of ['sourceLoads','previewLoads','canvasBuilds','queuedLoads'])check(afterMetadata[key]===beforeMetadata[key],'Metadata discovery warmed '+key);
 // Reset native caches and verify that every accepted library thumbnail comes
 // from the edited compact overview alone, before any full image is warmed.
 runtime.clear();const beforeCold=runtime.stats;await runtime.warmPreviews();let compactViews=0;
 for(const patch of patches)if(patch.preview){
  const a=catalog.get(patch.id),f=patch.facing??'south',v=a.getFacingView?.(f,{image:false})??a,p=patch.preview,r=p.draw??patch.draw,s=a.getFacingDrawSource(f,{native:false});
  check(s?.quality==='parallel-preview'&&s.native===false,'Cold library retained original art '+a.id+'/'+f);
  const im=await reference(p.file),[expected,E]=make(v.w,v.h),[actual,A]=make(v.w,v.h);draw(E,{image:im,sx:p.x??0,sy:p.y??0,sw:p.w??p.width,sh:p.h??p.height,dx:r.x,dy:r.y,dw:r.w,dh:r.h});draw(A,s);compare(actual,expected,a.id+'/'+f+' compact preview');
  if(f==='south'){const [library,L]=make(v.w,v.h);a.draw(L);compare(library,expected,a.id+' cold library draw');library.width=library.height=1;}
  expected.width=expected.height=actual.width=actual.height=1;compactViews++;
 }
 check(runtime.stats.sourceLoads===beforeCold.sourceLoads,'Compact library preview warmed native sheets');
 const rows=[],families=[],aliasGaps=[],nativeByKey=new Map(patches.map(p=>[p.id+'|'+(p.facing??'south'),p]));
 for(const patch of patches){
  const a=catalog.get(patch.id),facing=patch.facing??'south';check(a,'Missing saved catalog ID '+patch.id);
  await a.ensureFull(facing);
  const view=a.getFacingView?.(facing,{image:false})??a,w=view.w,h=view.h,source=a.getFacingDrawSource(facing,{native:true});
  check(source?.image&&source.native===true,'ensureFull returned without accepted native pixels '+a.id+'/'+facing);
  const im=await reference(patch.file);check(im.width===patch.width&&im.height===patch.height,'Native sheet metadata mismatch '+patch.file);
  const expectedSource={image:im,sx:patch.x??0,sy:patch.y??0,sw:patch.w??patch.width,sh:patch.h??patch.height,dx:patch.draw.x,dy:patch.draw.y,dw:patch.draw.w,dh:patch.draw.h};
  const [nativeReference,N]=make(expectedSource.sw,expectedSource.sh);N.drawImage(im,expectedSource.sx,expectedSource.sy,expectedSource.sw,expectedSource.sh,0,0,nativeReference.width,nativeReference.height);
  const [nativeActual,Q]=make(expectedSource.sw,expectedSource.sh);Q.drawImage(source.image,source.sx??0,source.sy??0,source.sw,source.sh,0,0,nativeActual.width,nativeActual.height);compare(nativeActual,nativeReference,a.id+'/'+facing+' exact native crop');
  // Keep the independent native reference's backing envelope identical to
  // the isolated production crop. At fractional contain coordinates even
  // nearest sampling can choose a different boundary pixel from a big atlas.
  Object.assign(expectedSource,{image:nativeReference,sx:0,sy:0});
  const [expected,E]=make(w,h);draw(E,expectedSource);
  const [actual,A]=make(w,h);draw(A,source);compare(actual,expected,a.id+'/'+facing+' native source');
  const ink=pixels(actual);let opaque=0;for(let i=3;i<ink.length;i+=4)if(ink[i]>20)opaque++;check(opaque>0,'Blank accepted native view '+a.id+'/'+facing);
  // Public legacy image/canvas APIs occupy the same original view envelope.
  const image=a.getFacingImage?.(facing)??(facing==='south'?a.canvas:null);
  if(image){
   const [canvas,C]=make(w,h);C.drawImage(image,0,0,canvas.width,canvas.height);
   try{compare(canvas,expected,a.id+'/'+facing+' legacy image');}catch(error){window.__parallelDebug={id:a.id,facing,stage:'legacy-image',view:{w,h,footCenter:view.footCenter},imageSize:[image.width,image.height],sourceImageSize:[source.image.width,source.image.height],sameNativeImage:image===source.image,source:{...source,image:undefined},rendered:canvas.toDataURL(),expected:expected.toDataURL()};throw error;}
   canvas.width=canvas.height=1;
  }
  if(facing==='south'){
   const [direct,D]=make(w,h);a.draw(D);compare(direct,expected,a.id+' original draw API');direct.width=direct.height=1;
   const [canvas,C]=make(w,h);C.drawImage(a.canvas,0,0,canvas.width,canvas.height);compare(canvas,expected,a.id+' South canvas getter');canvas.width=canvas.height=1;
  }
  const [filtered,F]=make(w,h);F.filter=assetFilter(a);draw(F,expectedSource);
  const preview=await prepareAssetPreview(a,facing),[review,R]=make(preview.width,preview.height);preview.draw(R,0);compare(review,filtered,a.id+'/'+facing+' reviewer');
  // This is the production Builder PNG export path, including its filter and
  // legacy getFacingImage call. Compare its decoded PNG, rather than a mock.
  await a.ensureFull(facing);const [exportCanvas,X]=make(w,h);X.filter=assetFilter(a);const exportView=a.getFacingView?.(facing,{image:false});
  if(exportView)X.drawImage(a.getFacingImage(facing),0,0,exportCanvas.width,exportCanvas.height);else a.draw(X);
  const blob=await new Promise(resolve=>exportCanvas.toBlob(resolve,'image/png')),bitmap=await createImageBitmap(blob),[decoded,P]=make(w,h);P.drawImage(bitmap,0,0);compare(decoded,filtered,a.id+'/'+facing+' PNG export');bitmap.close();
  // Execute drawObject with the actual facing placement, source cache and
  // grading used by Builder/Play, comparing to an independent native crop.
  const object={id:'parallel-check',asset:a.id,x:512,y:512,scale:1,rotation:facingRotation(facing),layer:a.layer,collision:false},pose={x:512,y:512,offset:1},placement=furnitureFacingPlacement(a,object,pose,{includeImage:false});
  if(placement){
   const [rendered,G]=make(w,h);G.translate(-placement.x,-placement.y);drawObject(G,object,{cells:{},edges:{},objects:[object]},false,1,0,null,{pose,facing:placement,native:true});
   // Skia's high-quality reduction depends on the backing image envelope.
   // Compare isolated native pixels to an independent isolated reference;
   // atlas-vs-cutout reduction can otherwise differ at translucent edges.
   const rendererSource={...expectedSource,image:nativeReference,sx:0,sy:0};
   const [rendererReference,H]=make(w,h);H.translate(-placement.x,-placement.y);H.filter=assetFilter(a);drawFurnitureFacingSource(H,placement,rendererSource);
   try{compare(rendered,rendererReference,a.id+'/'+facing+' live renderer');}catch(error){window.__parallelDebug={id:a.id,facing,rendered:rendered.toDataURL(),expected:rendererReference.toDataURL(),placement,source:{...a.getFacingDrawSource(facing,{native:true}),image:undefined},expectedSource:{...expectedSource,image:undefined}};throw error;}
   rendered.width=rendered.height=rendererReference.width=rendererReference.height=1;
  }else if(a.wallMounted||a.layer==='ground'){
   const flat=flatFurnitureFacingPlacement(a,spriteBounds(a,object,pose));check(flat,'Missing flat native source path '+a.id);
   const [rendered,G]=make(w,h),origin={x:pose.x-a.w/2,y:pose.y-a.h};G.translate(-origin.x,-origin.y);drawObject(G,object,{cells:{},edges:{},objects:[object]},false,1,0,null,{pose,flat,native:true});
   const [rendererReference,H]=make(w,h);H.translate(-origin.x,-origin.y);H.translate(pose.x,pose.y);H.rotate(object.rotation*Math.PI/180);H.scale(object.scale,object.scale);H.filter=assetFilter(a);
   drawFurnitureFacingSource(H,flatFurnitureFacingLocalPlacement(a,pose,flat),{...expectedSource,image:nativeReference,sx:0,sy:0});compare(rendered,rendererReference,a.id+' flat live renderer');rendered.width=rendered.height=rendererReference.width=rendererReference.height=1;
  }
  // Rugs/plants share their corrected donor dynamically, including the new
  // source revision and native pixel crop; no copied old thumbnail may remain.
  for(const derived of catalog.values())if(derived.sourceAssetId===a.id&&['rug','plant'].includes(derived.slot)&&!nativeByKey.has(derived.id+'|'+facing)){
   await derived.ensureFull(facing);const ds=derived.getFacingDrawSource(facing,{native:true}),donor=a.getFacingDrawSource(facing,{native:true});
   check(ds?.native&&ds.image===donor.image&&ds.sx===donor.sx&&ds.sy===donor.sy&&ds.sw===donor.sw&&ds.sh===donor.sh,'Family product retained old native art '+derived.id+'/'+facing);families.push(derived.id+'|'+facing);
  }
  for(const alias of catalog.values())if(alias.aliasOf===a.id&&!nativeByKey.has(alias.id+'|'+facing))aliasGaps.push({source:a.id,alias:alias.id,facing});
  rows.push({id:a.id,facing,file:patch.file,crop:[patch.x??0,patch.y??0,patch.w??patch.width,patch.h??patch.height],world:[w,h],footCenter:view.footCenter,hash:await digest(pixels(actual)),ink:opaque,renderer:!!placement||a.wallMounted||a.layer==='ground',owner:a.owner});
  for(const canvas of [expected,actual,filtered,review,exportCanvas,decoded,nativeReference,nativeActual])canvas.width=canvas.height=1;assertBudget();
 }
 // The same settled draw API must be stable across frames, without new native
 // decodes/canvas builds. Use the final loaded view so it cannot be evicted by
 // the verification itself.
 if(patches.length){
  const p=patches.at(-1),a=catalog.get(p.id),f=p.facing??'south';await a.ensureFull(f);const stable=a.getFacingDrawSource(f,{native:true}),before=runtime.stats;
  for(let i=0;i<500;i++)check(a.getFacingDrawSource(f,{native:true})===stable,'Settled draw source allocated a new descriptor');
  const after=runtime.stats;for(const key of ['sourceLoads','canvasBuilds'])check(after[key]===before[key],'Settled frames rebuilt '+key);
 }
 // Exercise failure/retry and eviction using the actual accepted native files
 // and real browser canvases, with isolated asset clones and a tiny LRU.
 let stress=null;
 if(patches.length){
  const {createParallelArtRuntime}=await appModule('/town/world/parallel-art-runtime.mjs');
  const sourcePatches=patches.length>1?patches.slice(0,2):[patches[0]],clones=new Map();
  for(const p of sourcePatches){const a=catalog.get(p.id);if(!clones.has(p.id))clones.set(p.id,Object.create(Object.getPrototypeOf(a),Object.getOwnPropertyDescriptors(a)));}
  const accepted=sourcePatches.map((p,i)=>({...p,file:p.file+'?native-probe='+i,preview:undefined}));let fail=true,attempts=0;
  const isolated=createParallelArtRuntime(clones,{patches:accepted,maxSources:1,maxCanvases:1,
   loadImage:async file=>{attempts++;if(fail)throw Error('intentional browser retry probe');const r=await fetch('/town/assets/parallel-art/'+file);return createImageBitmap(await r.blob());}});
  const first=accepted[0],a=clones.get(first.id),f=first.facing??'south';let rejected=false;try{await a.ensureFull(f);}catch{rejected=true;}check(rejected,'Native source failure was silently accepted');
  const failedAttempts=attempts;for(let i=0;i<20;i++)a.getFacingDrawSource(f,{native:true});check(attempts===failedAttempts,'Each draw retried the failed native source');
  fail=false;await a.ensureFull(f);const descriptor=a.getFacingDrawSource(f,{native:true}),crop=descriptor.image;check(descriptor.native,'Explicit source retry failed');
  if(accepted.length>1){const second=accepted[1];await clones.get(second.id).ensureFull(second.facing??'south');check(crop.width===1&&descriptor.image===null,'LRU retained an evicted native canvas');}
  const final=isolated.stats;check(final.sourceEntries<=1&&final.canvasEntries<=1,'Isolated native LRU exceeded its limit');
  isolated.clear();stress={failureRejected:rejected,explicitRetry:true,evictionExercised:accepted.length>1,attempts,afterClear:isolated.stats};
 }
 assertBudget();return {patches,rows,families,aliasGaps,stress,compactViews,metadataCold:true,beforeMetadata,afterMetadata,runtime:runtime.stats};
}'''


def artifact_checks(patches):
    """Inspect native bytes/alpha and retain generation/source provenance."""
    root = (ROOT / 'town/assets/parallel-art').resolve()
    rows = []
    opened = {}
    hashes = {}
    manifest = root / 'packed-manifest.json'
    provenance_by_key = {}
    if manifest.is_file():
        packed = json.loads(manifest.read_text())
        provenance_by_key = {(p['id'], p.get('facing', 'south')): p for p in packed.get('patches', [])}
    for patch in patches:
        patch = {**provenance_by_key.get((patch['id'], patch.get('facing', 'south')), {}), **patch}
        path = (root / patch['file']).resolve()
        assert path.is_relative_to(root) and path.is_file(), path
        if path not in opened:
            while len(opened) >= 2:
                opened.pop(next(iter(opened))).close()
            with Image.open(path) as original:
                assert original.format in {'PNG', 'WEBP'}, (path, original.format)
                assert 'A' in original.getbands(), (path, 'Native atlas must carry alpha')
                opened[path] = original.convert('RGBA')
            hashes[path] = hashlib.sha256(path.read_bytes()).hexdigest()
        image = opened[path]
        assert image.size == (patch['width'], patch['height']), path
        x, y = patch.get('x', 0), patch.get('y', 0)
        w, h = patch.get('w', patch['width']), patch.get('h', patch['height'])
        assert min(x, y) >= 0 and min(w, h) > 0 and x + w <= image.width and y + h <= image.height
        alpha = image.getchannel('A').crop((x, y, x + w, y + h))
        assert alpha.getbbox(), (patch['id'], 'Blank native crop')
        provenance = {key: value for key, value in patch.items() if any(part in key.lower() for part in ['source', 'digest', 'generation', 'review', 'provenance', 'supersedes', 'revision'])}
        generation = patch.get('generation', {})
        if not isinstance(generation, dict):
            generation = {}
        original_hash_verified = False
        if generation.get('original') and generation.get('originalSHA256'):
            original = (root / generation['original']).resolve()
            assert original.is_relative_to(root) and original.is_file(), original
            assert hashlib.sha256(original.read_bytes()).hexdigest() == generation['originalSHA256'], original
            original_hash_verified = True
        rows.append({'id': patch['id'], 'facing': patch.get('facing', 'south'), 'file': patch['file'],
                     'sha256': hashes[path], 'alphaRange': alpha.getextrema(),
                     'cropPixels': w * h, 'provenance': provenance, 'originalHashVerified': original_hash_verified})
    for image in opened.values():
        image.close()
    return rows


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
errors = []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        baseline_context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        baseline_context.route('**/parallel-art-data.mjs*', lambda route: route.fulfill(
            status=200, content_type='text/javascript', body='export const PARALLEL_ART_PATCHES=Object.freeze([]);'))
        baseline = baseline_context.new_page()
        baseline.set_default_timeout(240000)
        baseline.on('pageerror', lambda error: errors.append('baseline: ' + str(error)))
        baseline.goto(origin + '/town/asset-review/')
        baseline.wait_for_function('!!window.townAssetReview?.catalog || document.getElementById("previewStatus")?.dataset.error==="true"')
        assert baseline.evaluate('!!window.townAssetReview?.catalog'), baseline.locator('#previewStatus').inner_text()
        before = baseline.evaluate(SNAPSHOT)
        baseline_context.close()

        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        page = context.new_page()
        page.set_default_timeout(240000)
        page.on('pageerror', lambda error: errors.append('production: ' + str(error)))
        page.goto(origin + '/town/asset-review/')
        page.wait_for_function('!!window.townAssetReview?.catalog || document.getElementById("previewStatus")?.dataset.error==="true"')
        assert page.evaluate('!!window.townAssetReview?.catalog'), page.locator('#previewStatus').inner_text()
        after = page.evaluate(SNAPSHOT)
        declarations = page.evaluate('''async()=>{
          const loaded=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname==='/town/world/parallel-art-data.mjs').at(-1);
          return (await import(loaded.name)).PARALLEL_ART_PATCHES;
        }''')
        metadata_motion = assert_motion_metadata(before, after, declarations)
        original_by_id = {row['id']: row for row in before}
        arcade_declarations = [patch for patch in declarations if patch.get('motionGeometry') and
                               (original_by_id[patch['id']]['views'].get(patch.get('facing', 'south'), {}).get('motion') or
                                original_by_id[patch['id']].get('motion') or {}).get('kind') == 'arcade']
        assert len(arcade_declarations) == args.expected_arcades, ('Unexpected declared arcade screen count', len(arcade_declarations))
        try:
            result = page.evaluate(PROBE, {'allowEmpty': args.allow_empty})
        except Exception:
            diagnostic = page.evaluate('window.__parallelDebug || null')
            if diagnostic:
                for name in ['rendered', 'expected']:
                    (args.output / (name + '.png')).write_bytes(base64.b64decode(diagnostic.pop(name).split(',', 1)[1]))
                (args.output / 'failure.json').write_text(json.dumps(diagnostic, indent=2))
            raise
        result['motionMetadata'] = metadata_motion
        result['physicalMetadataUnchanged'] = len(after)
        (args.output / 'browser-results.json').write_text(json.dumps(result, indent=2))
        page.emulate_media(reduced_motion='no-preference')
        page.wait_for_function('!matchMedia("(prefers-reduced-motion: reduce)").matches')
        try:
            result['arcadeAnimation'] = page.evaluate(MOTION_PROBE, {'expectedArcades': args.expected_arcades, 'baseline': before})
        except Exception:
            diagnostic = page.evaluate('window.__parallelMotionDebug || null')
            if diagnostic:
                for name in ['base', 'frame', 'allowed']:
                    (args.output / ('motion-' + name + '.png')).write_bytes(base64.b64decode(diagnostic.pop(name).split(',', 1)[1]))
                (args.output / 'motion-failure.json').write_text(json.dumps(diagnostic, indent=2))
            raise
        # Real source failures must switch both asset/view geometry back to the
        # original glass, even after the new animation was rendered natively.
        page.route('**/town/assets/parallel-art/**', lambda route: route.abort('failed'))
        result['arcadeMotionFallback'] = page.evaluate(MOTION_FALLBACK_PROBE, {'expectedArcades': args.expected_arcades, 'baseline': before})
        result['artifacts'] = artifact_checks(result['patches'])
        result['pageErrors'] = errors
        (args.output / 'results.json').write_text(json.dumps(result, indent=2))
        assert not errors, errors
        browser.close()
    print(json.dumps({'nativeViews': len(result['rows']), 'physicalMetadataUnchanged': len(after),
                      'familyViews': len(result['families']), 'aliasCoverageGaps': result['aliasGaps'],
                      'metadataCold': result['metadataCold'], 'arcadeAnimationViews': result['arcadeAnimation']['views'],
                      'arcadeFallbackViews': result['arcadeMotionFallback']['views'], 'pageErrors': errors}), flush=True)
finally:
    server.shutdown()
