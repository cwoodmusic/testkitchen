import {createAssetReview} from './review-model.mjs?v=town-asset-review-1';
import {availableFacings,prepareAssetPreview} from './preview.mjs?v=town-asset-review-1';
import {registerReviewRoomRugs} from './catalog-extras.mjs?v=town-asset-review-1';

const $=id=>document.getElementById(id),canvas=$('preview'),context=canvas.getContext('2d'),CURSOR_KEY='codaTownAssetReviewCursorV1';
const names={south:'South',west:'West',north:'North',east:'East'};
let catalog,assets=[],review,filtered=[],assetId='',facing='south',preview=null,ticket=0,pan={x:0,y:0},drag=null,loadChain=Promise.resolve();
const text=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
function saveCursor(){try{localStorage.setItem(CURSOR_KEY,JSON.stringify({assetId,facing}));}catch{}}
function recordsFor(id){return review.entries().filter(record=>record.assetId===id);}
function optionLabel(asset){const records=recordsFor(asset.id),mark=records.some(r=>r.status==='flagged')?'⚑ ':records.some(r=>r.status==='ok')?'✓ ':'';return mark+asset.name+' · '+asset.id;}
function updateProgress(){
 const entries=review.entries(),reviewed=entries.filter(r=>r.status!=='unreviewed').length,flagged=entries.filter(r=>r.status==='flagged').length;
 text($('summary'),`${assets.length.toLocaleString()} assets · ${reviewed.toLocaleString()} views reviewed · ${flagged.toLocaleString()} flagged`);
 text($('saveStatus'),review.saved?'Saved in this browser':'Download to keep your notes');
 $('storageWarning').hidden=!review.warning;text($('storageWarning'),review.warning||'');
 if(assetId){const option=[...$('assetPicker').options].find(option=>option.value===assetId);if(option)text(option,optionLabel(catalog.get(assetId)));}
}
function paint(){
 const stage=$('previewStage'),width=Math.max(1,stage.clientWidth),height=Math.max(1,stage.clientHeight),dpr=Math.min(2,window.devicePixelRatio||1);
 const w=Math.round(width*dpr),h=Math.round(height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);if(!preview)return;
 const scale=$('zoom').value==='fit'?Math.min((width-64)/preview.width,(height-64)/preview.height,4):Number($('zoom').value);
 context.save();try{context.imageSmoothingEnabled=false;context.translate(width/2+pan.x,height/2+pan.y);context.scale(scale,scale);context.translate(-preview.width/2,-preview.height/2);preview.draw(context);}finally{context.restore();}
}
function reflectReview(){
 const current=review.get(assetId,facing);
 if($('note').value!==current.note)$('note').value=current.note;
 for(const[id,status]of [['flagReview','flagged'],['markGood','ok'],['clearStatus','unreviewed']])$(id).setAttribute('aria-pressed',String(current.status===status));
 for(const button of $('facings').children)button.dataset.status=review.get(assetId,button.dataset.facing).status;
 updateProgress();
}
function updateNavigation(){
 const index=filtered.findIndex(asset=>asset.id===assetId),globalIndex=assets.findIndex(asset=>asset.id===assetId);
 $('previous').disabled=index<=0;$('next').disabled=index<0||index>=filtered.length-1;
 text($('counter'),index<0?'':`${index+1} / ${filtered.length}${filtered.length===assets.length?'':' shown'}`);
 $('jumpIndex').value=globalIndex<0?'1':String(globalIndex+1);
}
function rebuildPicker(){
 const terms=$('search').value.toLowerCase().trim().split(/\s+/).filter(Boolean),category=$('category').value,filter=$('reviewFilter').value;
 const records=new Map();for(const record of review.entries()){if(!records.has(record.assetId))records.set(record.assetId,[]);records.get(record.assetId).push(record);}
 filtered=assets.filter(asset=>{
  if(category&&asset.group!==category)return false;
  const entries=records.get(asset.id)||[],searchable=[asset.name,asset.id,asset.group,...entries.map(r=>r.note)].join(' ').toLowerCase();
  if(!terms.every(term=>searchable.includes(term)))return false;
  return filter==='flagged'?entries.some(r=>r.status==='flagged'):filter==='noted'?entries.some(r=>r.note.trim()):filter==='unreviewed'?!entries.some(r=>r.status!=='unreviewed'):true;
 });
 const fragment=document.createDocumentFragment();
 for(const asset of filtered){const option=document.createElement('option');option.value=asset.id;const entries=records.get(asset.id)||[],mark=entries.some(r=>r.status==='flagged')?'⚑ ':entries.some(r=>r.status==='ok')?'✓ ':'';option.textContent=mark+asset.name+' · '+asset.id;fragment.append(option);}
 $('assetPicker').replaceChildren(fragment);$('assetPicker').disabled=!filtered.length;
 if(filtered.some(asset=>asset.id===assetId))$('assetPicker').value=assetId;
 return filtered;
}
async function goTo(id,direction='south'){
 const asset=catalog.get(id);if(!asset)throw Error('That asset is not in the catalog.');
 if(!filtered.some(a=>a.id===id)){$('search').value='';$('category').value='';$('reviewFilter').value='all';rebuildPicker();}
 assetId=id;const facings=availableFacings(asset);facing=facings.includes(direction)?direction:facings[0];preview=null;pan={x:0,y:0};$('zoom').value='fit';
 text($('assetName'),asset.name);text($('assetId'),asset.id);text($('assetGroup'),asset.group);$('assetPicker').value=id;$('emptyState').hidden=true;
 $('facings').replaceChildren();for(const value of facings){const button=document.createElement('button');button.dataset.facing=value;button.textContent=facings.length===1?'Original'+(asset.facing&&asset.facing!=='south'?' · '+names[asset.facing]:''):names[value];button.setAttribute('aria-pressed',String(facing===value));button.onclick=()=>void goTo(id,value);$('facings').append(button);}
 text($('viewLabel'),facings.length===1?'Reviewing this asset’s original artwork.':`Reviewing the ${names[facing].toLowerCase()} view. Each direction has its own notes.`);
 for(const control of [$('flagReview'),$('markGood'),$('clearStatus'),$('note')])control.disabled=false;
 canvas.setAttribute('aria-label',asset.name+' · '+names[facing]+' preview');reflectReview();updateNavigation();saveCursor();paint();
 const request=++ticket;text($('previewStatus'),'Loading artwork…');$('previewStatus').dataset.error='false';$('retryPreview').hidden=true;
 try{
  const direction=facing,loaded=await(loadChain=loadChain.catch(()=>{}).then(()=>request===ticket?prepareAssetPreview(asset,direction):null));if(request!==ticket||!loaded)return;
  preview=loaded;paint();text($('previewStatus'),`Ready · ${loaded.width} × ${loaded.height}${loaded.actualFacing&&loaded.actualFacing!==facing?' · original '+(names[loaded.actualFacing]||loaded.actualFacing):''}`);
 }catch(error){if(request!==ticket)return;preview=null;paint();text($('previewStatus'),'Could not load artwork. You can still flag this view and describe the problem.');$('previewStatus').dataset.error='true';$('retryPreview').hidden=false;console.warn('Asset preview failed:',asset.id,facing,error);}
}
function filterChanged(){
 rebuildPicker();if(filtered.length){void goTo(filtered.some(a=>a.id===assetId)?assetId:filtered[0].id,facing);return;}
 ++ticket;preview=null;assetId='';paint();$('emptyState').hidden=false;text($('assetName'),'No matching assets');text($('assetId'),'');text($('counter'),'0 / 0');text($('previewStatus'),'Change the search or filters to keep browsing.');$('facings').replaceChildren();$('retryPreview').hidden=true;
 for(const id of ['flagReview','markGood','clearStatus','note','previous','next'])$(id).disabled=true;$('note').value='';
}
function navigate(delta){const index=filtered.findIndex(a=>a.id===assetId),next=filtered[index+delta];if(next)void goTo(next.id);}
function setStatus(status){if(!assetId)return;review.set(assetId,facing,{status});reflectReview();}
function downloadReview(){
 const report=review.snapshot();report.appVersion='town-asset-review-1';
 for(const item of report.reviews){const asset=catalog.get(item.assetId);if(!asset)continue;item.pack=asset.pack||null;item.owner=asset.collectionOwner||asset.owner||null;item.purpose=asset.purpose||null;item.sourceAssetId=asset.sourceAssetId||null;item.authoredFacing=asset.facing||'south';if(asset.texture)item.texture=asset.texture;if(asset.sourceRect)item.sourceRect={...asset.sourceRect};const view=asset.getFacingView?.(item.facing,{image:false});if(view)item.view={id:view.id||null,facing:view.facing||view.direction||item.facing,width:view.w,height:view.h};}
 const blob=new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='coda-asset-review.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function start(){
 const [{catalog:townCatalog},{groundTexture},{surfaces}]=await Promise.all([import('../world/catalog.mjs?v=town-coast-pier-1'),import('../world/ground-render.mjs?v=town-coast-pier-1'),import('../world/model.mjs?v=town-coast-pier-1')]);
 catalog=registerReviewRoomRugs(new Map(townCatalog));
 for(const surface of surfaces)catalog.set('surface:'+surface,{id:'surface:'+surface,name:surface[0].toUpperCase()+surface.slice(1)+' ground texture',group:'ground textures',w:512,h:512,facing:'south',draw(c){const image=groundTexture(surface);c.drawImage(image,0,0,512,512);}});
 assets=[...catalog.values()];review=createAssetReview({catalog});
 for(const group of [...new Set(assets.map(a=>a.group))].sort()){const option=document.createElement('option');option.value=group;option.textContent=group;$('category').append(option);}
 for(const id of ['search','category','reviewFilter','downloadReview','jumpIndex','jumpAsset'])$(id).disabled=false;
 $('jumpIndex').max=String(assets.length);rebuildPicker();
 $('assetPicker').onchange=()=>void goTo($('assetPicker').value);$('search').oninput=filterChanged;$('category').onchange=$('reviewFilter').onchange=filterChanged;
 $('previous').onclick=()=>navigate(-1);$('next').onclick=()=>navigate(1);$('flagReview').onclick=()=>setStatus('flagged');$('markGood').onclick=()=>setStatus('ok');$('clearStatus').onclick=()=>setStatus('unreviewed');
 $('note').oninput=()=>{if(!assetId)return;const current=review.get(assetId,facing),note=$('note').value;review.set(assetId,facing,{note,status:note.trim()&&current.status==='unreviewed'?'flagged':current.status});reflectReview();};
 $('downloadReview').onclick=downloadReview;$('retryPreview').onclick=()=>void goTo(assetId,facing);
 $('jumpAsset').onclick=()=>{const index=Number($('jumpIndex').value)-1;if(Number.isInteger(index)&&assets[index])void goTo(assets[index].id);};$('jumpIndex').onkeydown=e=>{if(e.key==='Enter')$('jumpAsset').click();};
 $('zoom').onchange=()=>{pan={x:0,y:0};paint();};$('background').onchange=()=>{$('previewStage').dataset.background=$('background').value;};
 canvas.onpointerdown=e=>{if(e.button!==0)return;canvas.focus();canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,pan:{...pan}};};
 canvas.onpointermove=e=>{if(!drag)return;pan={x:drag.pan.x+e.clientX-drag.x,y:drag.pan.y+e.clientY-drag.y};paint();};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
 document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();navigate(e.key==='ArrowRight'?1:-1);}else if(e.key.toLowerCase()==='f'&&!e.repeat){e.preventDefault();setStatus('flagged');}});
 new ResizeObserver(()=>paint()).observe($('previewStage'));
 window.townAssetReview={catalog,review,goTo,get assetId(){return assetId;},get facing(){return facing;},get filteredAssets(){return [...filtered];}};
 let cursor;try{cursor=JSON.parse(localStorage.getItem(CURSOR_KEY)||'null');}catch{}
 await goTo(catalog.has(cursor?.assetId)?cursor.assetId:assets[0].id,cursor?.facing||'south');
}
start().catch(error=>{text($('assetName'),'The asset library could not open');text($('previewStatus'),error?.message||'Reload the page to try again.');$('previewStatus').dataset.error='true';text($('saveStatus'),'Catalog unavailable');});
