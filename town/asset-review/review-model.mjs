export const ASSET_REVIEW_STORAGE_KEY='codaTownAssetReviewV1';
export const ASSET_REVIEW_FORMAT='coda-asset-review';
export const ASSET_REVIEW_ISSUES=Object.freeze([
 Object.freeze({id:'perspective',label:'Needs 2/3 perspective'}),
 Object.freeze({id:'cut-off',label:'Edges are cut off'}),
 Object.freeze({id:'angled',label:'Angled'}),
 Object.freeze({id:'delete',label:'Mark for deletion'})
]);
const STATUSES=new Set(['unreviewed','ok','flagged']),FACINGS=new Set(['south','west','north','east']);
const ISSUE_IDS=ASSET_REVIEW_ISSUES.map(issue=>issue.id);
const FORBIDDEN_IDS=new Set(['__proto__','constructor','prototype']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=300&&!FORBIDDEN_IDS.has(id)&&!/[\u0000-\u001f]/.test(id);
const key=(id,facing)=>JSON.stringify([id,facing]);
const text=value=>typeof value==='string'?value:'';
const dimension=value=>Number.isFinite(value)&&value>0?value:null;
const nonempty=entry=>entry.status!=='unreviewed'||entry.note.trim().length>0;
function normalizeIssues(issues){
 if(!Array.isArray(issues))throw new TypeError('Review issues must be an array.');
 if(issues.some(issue=>!ISSUE_IDS.includes(issue)))throw new RangeError('Unknown asset review issue.');
 return ISSUE_IDS.filter(issue=>issues.includes(issue));
}

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
     let issues=[];
     try{if(Object.hasOwn(entry,'issues'))issues=normalizeIssues(entry.issues);}catch{invalidEntry=true;issues=Array.isArray(entry.issues)?ISSUE_IDS.filter(issue=>entry.issues.includes(issue)):[];}
     const inferredStatus=issues.length&&entry.status==='flagged'?'unreviewed':entry.status,baseStatus=STATUSES.has(entry.baseStatus)?entry.baseStatus:inferredStatus;
     if(Object.hasOwn(entry,'baseStatus')&&!STATUSES.has(entry.baseStatus))invalidEntry=true;
     const value={...metadata(entry,entry.assetId),facing:entry.facing,status:issues.length?'flagged':baseStatus,baseStatus,note:entry.note,issues,updatedAt:typeof entry.updatedAt==='string'&&Number.isFinite(Date.parse(entry.updatedAt))?entry.updatedAt:null};
     if(nonempty(value))records.set(key(value.assetId,value.facing),value);
    }
    if(invalidEntry)throw Error('Invalid review entry');
   }catch{saved=false;writeBlocked=true;warning='Some saved review data could not be read. It has been preserved. Download new edits before leaving this tab.';}
  }
 }
 const entries=()=>Array.from(records.values(),entry=>({...entry,...(assets.get(entry.assetId)||{}),issues:[...entry.issues]}));
 function persist(){
  if(!storage||writeBlocked){saved=false;return;}
  try{storage.setItem(ASSET_REVIEW_STORAGE_KEY,JSON.stringify({format:ASSET_REVIEW_FORMAT,version:1,reviews:entries()}));saved=true;warning='';}
  catch{saved=false;warning='These edits could not be saved in this browser. They are still in this tab; download your review before leaving.';}
 }
 function get(assetId,facing='south'){
  const entry=records.get(key(assetId,facing));return entry?{status:entry.status,note:entry.note,issues:[...entry.issues]}:{status:'unreviewed',note:'',issues:[]};
 }
 function set(assetId,facing='south',patch={}){
  if(!validId(assetId))throw new TypeError('A valid asset ID is required.');
  if(!FACINGS.has(facing))throw new RangeError('Unknown asset facing.');
  if(!object(patch))throw new TypeError('An asset review update must be an object.');
  if(Object.hasOwn(patch,'status')&&!STATUSES.has(patch.status))throw new RangeError('Unknown review status.');
  if(Object.hasOwn(patch,'note')&&typeof patch.note!=='string')throw new TypeError('Review notes must be text.');
  const recordKey=key(assetId,facing),stored=records.get(recordKey),previous=get(assetId,facing),oldBase=stored?.baseStatus??previous.status,baseStatus=Object.hasOwn(patch,'status')?patch.status:oldBase,note=Object.hasOwn(patch,'note')?patch.note:previous.note;
  let issues=Object.hasOwn(patch,'issues')?normalizeIssues(patch.issues):previous.issues;
  // A deliberate status choice outranks old issue checkboxes. Otherwise their
  // derived flag never replaces the earlier manual review decision.
  if(Object.hasOwn(patch,'status')&&patch.status!=='flagged')issues=[];
  const status=issues.length?'flagged':baseStatus;
  if(previous.status===status&&previous.note===note&&oldBase===baseStatus&&previous.issues.length===issues.length&&previous.issues.every((issue,i)=>issue===issues[i])){if(!saved)persist();return get(assetId,facing);}
  const entry={...(stored||metadata(null,assetId)),...(assets.get(assetId)||{}),facing,status,baseStatus,note,issues,updatedAt:timestamp()};
  if(nonempty(entry))records.set(recordKey,entry);else records.delete(recordKey);
  persist();return get(assetId,facing);
 }
 function snapshot(){
  const reviews=entries(),reviewed=reviews.filter(entry=>entry.status!=='unreviewed'),flagged=reviews.filter(entry=>entry.status==='flagged');
  return {format:ASSET_REVIEW_FORMAT,version:1,repository:'cwoodmusic/testkitchen',exportedAt:timestamp(),catalogAssetCount:assets.size,issueLabels:Object.fromEntries(ASSET_REVIEW_ISSUES.map(issue=>[issue.id,issue.label])),
   counts:{entries:reviews.length,reviewed:reviewed.length,flagged:flagged.length,noted:reviews.filter(entry=>entry.note.trim().length>0).length,assetsReviewed:new Set(reviewed.map(entry=>entry.assetId)).size,assetsFlagged:new Set(flagged.map(entry=>entry.assetId)).size},reviews};
 }
 return {get,set,entries,snapshot,get warning(){return warning;},get saved(){return saved;}};
}
