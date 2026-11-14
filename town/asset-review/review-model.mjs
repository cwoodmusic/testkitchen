export const ASSET_REVIEW_STORAGE_KEY='codaTownAssetReviewV1';
export const ASSET_REVIEW_FORMAT='coda-asset-review';
const STATUSES=new Set(['unreviewed','ok','flagged']),FACINGS=new Set(['south','west','north','east']);
const FORBIDDEN_IDS=new Set(['__proto__','constructor','prototype']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=300&&!FORBIDDEN_IDS.has(id)&&!/[\u0000-\u001f]/.test(id);
const key=(id,facing)=>JSON.stringify([id,facing]);
const text=value=>typeof value==='string'?value:'';
const dimension=value=>Number.isFinite(value)&&value>0?value:null;
const nonempty=entry=>entry.status!=='unreviewed'||entry.note.trim().length>0;

function metadata(asset,id){
 return {assetId:id,name:text(asset?.name)||id,group:text(asset?.group),width:dimension(asset?.width??asset?.w),height:dimension(asset?.height??asset?.h)};
}

/** Browser review notes live separately from town maps, rooms and profiles. */
export function createAssetReview({storage,now=()=>new Date(),catalog=new Map()}={}){
 if(typeof now!=='function')throw new TypeError('The asset review clock must be a function.');
 const assets=new Map(),records=new Map();
 if(catalog instanceof Map){for(const [id,asset]of catalog)if(validId(id))assets.set(id,metadata(asset,id));}
 else if(Array.isArray(catalog)){for(const asset of catalog){const id=asset?.assetId??asset?.id;if(validId(id))assets.set(id,metadata(asset,id));}}
 else throw new TypeError('The asset review catalog must be a Map or metadata array.');
 let warning='',saved=true,writeBlocked=false,lastTimestamp='1970-01-01T00:00:00.000Z';
 const timestamp=()=>{try{const date=new Date(now());if(Number.isFinite(date.getTime()))lastTimestamp=date.toISOString();}catch{}return lastTimestamp;};
 if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
 if(!storage?.getItem||!storage?.setItem){storage=null;saved=false;warning='Browser saving is unavailable. Download your review before leaving this tab.';}
 else{
  let raw;
  try{raw=storage.getItem(ASSET_REVIEW_STORAGE_KEY);}catch{saved=false;warning='Your saved review could not be opened. Download new edits before leaving this tab.';writeBlocked=true;}
  if(raw!==null&&raw!==undefined){
   try{
    const doc=JSON.parse(raw);
    if(!object(doc)||doc.format!==ASSET_REVIEW_FORMAT||doc.version!==1||!Array.isArray(doc.reviews))throw Error('Unsupported review');
    let invalidEntry=false;
    for(const entry of doc.reviews){
     if(!object(entry)||!validId(entry.assetId)||!FACINGS.has(entry.facing)||!STATUSES.has(entry.status)||typeof entry.note!=='string'){invalidEntry=true;continue;}
     const value={...metadata(entry,entry.assetId),facing:entry.facing,status:entry.status,note:entry.note,updatedAt:typeof entry.updatedAt==='string'&&Number.isFinite(Date.parse(entry.updatedAt))?entry.updatedAt:null};
     if(nonempty(value))records.set(key(value.assetId,value.facing),value);
    }
    if(invalidEntry)throw Error('Invalid review entry');
   }catch{saved=false;writeBlocked=true;warning='Some saved review data could not be read. It has been preserved. Download new edits before leaving this tab.';}
  }
 }
 const entries=()=>Array.from(records.values(),entry=>({...entry,...(assets.get(entry.assetId)||{})}));
 function persist(){
  if(!storage||writeBlocked){saved=false;return;}
  try{storage.setItem(ASSET_REVIEW_STORAGE_KEY,JSON.stringify({format:ASSET_REVIEW_FORMAT,version:1,reviews:entries()}));saved=true;warning='';}
  catch{saved=false;warning='These edits could not be saved in this browser. They are still in this tab; download your review before leaving.';}
 }
 function get(assetId,facing='south'){
  const entry=records.get(key(assetId,facing));return entry?{status:entry.status,note:entry.note}:{status:'unreviewed',note:''};
 }
 function set(assetId,facing='south',patch={}){
  if(!validId(assetId))throw new TypeError('A valid asset ID is required.');
  if(!FACINGS.has(facing))throw new RangeError('Unknown asset facing.');
  if(!object(patch))throw new TypeError('An asset review update must be an object.');
  if(Object.hasOwn(patch,'status')&&!STATUSES.has(patch.status))throw new RangeError('Unknown review status.');
  if(Object.hasOwn(patch,'note')&&typeof patch.note!=='string')throw new TypeError('Review notes must be text.');
  const previous=get(assetId,facing),status=Object.hasOwn(patch,'status')?patch.status:previous.status,note=Object.hasOwn(patch,'note')?patch.note:previous.note;
  if(previous.status===status&&previous.note===note){if(!saved)persist();return {status,note};}
  const recordKey=key(assetId,facing),entry={...(records.get(recordKey)||metadata(null,assetId)),...(assets.get(assetId)||{}),facing,status,note,updatedAt:timestamp()};
  if(nonempty(entry))records.set(recordKey,entry);else records.delete(recordKey);
  persist();return {status,note};
 }
 function snapshot(){
  const reviews=entries(),reviewed=reviews.filter(entry=>entry.status!=='unreviewed'),flagged=reviews.filter(entry=>entry.status==='flagged');
  return {format:ASSET_REVIEW_FORMAT,version:1,repository:'cwoodmusic/testkitchen',exportedAt:timestamp(),catalogAssetCount:assets.size,
   counts:{entries:reviews.length,reviewed:reviewed.length,flagged:flagged.length,noted:reviews.filter(entry=>entry.note.trim().length>0).length,assetsReviewed:new Set(reviewed.map(entry=>entry.assetId)).size,assetsFlagged:new Set(flagged.map(entry=>entry.assetId)).size},reviews};
 }
 return {get,set,entries,snapshot,get warning(){return warning;},get saved(){return saved;}};
}
