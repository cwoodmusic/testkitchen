import {createDefaultProject,normalizeProject} from './developer-project.mjs';
import {getNpcSpriteFrame} from './npc-sprites.mjs';
import {REVIEW_STORAGE_KEY,MAX_REVIEW_COMMENT_LENGTH,createRoomReviewCatalog,createRoomReview} from './room-review.mjs';

const $=id=>document.getElementById(id);
const make=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};
const release=document.querySelector('meta[name="quiet-bell-release"]')?.content??'source';
const project=normalizeProject(createDefaultProject()),catalog=createRoomReviewCatalog(project);
const status=$('review-status');
let storageAvailable=true,saved=null,loadWarning='';
try{const value=localStorage.getItem(REVIEW_STORAGE_KEY);if(value)saved=JSON.parse(value);}catch{loadWarning='Saved comments could not be read. You can import an exported review file.';}
let review;
try{review=createRoomReview({catalog,saved,gameTitle:project.settings.title});}catch(error){review=createRoomReview({catalog,gameTitle:project.settings.title});loadWarning='Saved comments could not be loaded. Your saved file has been left in place. Import a valid review file to continue.';}
let activeRoomId=catalog.some(room=>room.id===saved?.activeRoomId)?saved.activeRoomId:catalog[0].id;
let filter='all',query='',savingBlocked=!!loadWarning;
const currentRoom=()=>catalog.find(room=>room.id===activeRoomId);
const roomState=id=>review.state.rooms.find(room=>room.id===id);
const hasComments=room=>!!(room?.comment?.trim()||room?.items?.some(item=>item.comment?.trim()));
const name=id=>project.content[activeRoomId]?.people.find(person=>person.id===id)?.name??(id==='mira'?'Mira':id==='narrator'?'Narrator':id?.[0]?.toUpperCase()+id?.slice(1));
const asset=path=>new URL(path,import.meta.url).href;
const returnUrl=/\/releases\/r-[a-f\d]+\//.test(new URL(import.meta.url).pathname)?new URL('../../',import.meta.url):new URL('./',import.meta.url);
$('review-return').href=returnUrl.href;
$('review-room-comment').maxLength=MAX_REVIEW_COMMENT_LENGTH;

function setStatus(text,{error=false}={}){status.textContent=text;status.dataset.error=String(error);}
function save({message='Saved on this device.'}={}){
  if(savingBlocked){setStatus('Saved comments could not be loaded, so they have not been overwritten. Export your current notes or import a valid review file.',{error:true});return;}
  try{localStorage.setItem(REVIEW_STORAGE_KEY,JSON.stringify({...review.serialize(),activeRoomId}));storageAvailable=true;setStatus(message);}
  catch{storageAvailable=false;setStatus('This browser could not save your comments. Export a file before closing this page.',{error:true});}
}
function updateSidebar(){
  const states=review.state.rooms,reviewed=catalog.filter(room=>states.find(item=>item.id===room.id)?.reviewed).length;
  $('review-progress').textContent=`${reviewed} / ${catalog.length} reviewed`;
  const list=$('review-room-list');list.replaceChildren();
  const shown=catalog.filter(room=>{
    const value=states.find(item=>item.id===room.id);
    return (!query||room.title.toLocaleLowerCase().includes(query)||room.id.toLocaleLowerCase().includes(query))&&(filter!=='unreviewed'||!value?.reviewed)&&(filter!=='comments'||hasComments(value));
  });
  $('review-filter-empty').hidden=shown.length>0;
  for(const room of shown){
    const value=states.find(item=>item.id===room.id),button=make('button','room-choice');button.type='button';button.dataset.roomId=room.id;button.setAttribute('aria-current',String(room.id===activeRoomId));
    const image=make('img');image.src=asset(room.image);image.alt='';image.loading='lazy';image.decoding='async';image.width=58;image.height=39;
    const label=make('span','room-choice-title',room.title);
    if(hasComments(value))label.append(make('span','room-choice-status','Has comments'));
    const check=make('span','room-choice-check',value?.reviewed?'✓':'');check.setAttribute('aria-hidden','true');
    button.setAttribute('aria-label',`${room.title}${value?.reviewed?', reviewed':''}${hasComments(value)?', has comments':''}`);button.append(image,label,check);
    button.addEventListener('click',()=>selectRoom(room.id,{focus:true}));list.append(button);
  }
}
function scalePreview(){const world=$('review-preview').firstElementChild;if(world)world.style.transform=`scale(${$('review-preview').clientWidth/Number(world.dataset.width)})`;}
function renderPreview(room){
  const scene=room.scene,width=scene.geometry.width,height=scene.geometry.height,world=make('div','preview-world');world.dataset.width=String(width);
  Object.assign(world.style,{width:`${width}px`,height:`${height}px`,transformOrigin:'0 0',position:'relative'});
  $('review-preview').style.aspectRatio=`${width}/${height}`;
  const image=make('img','room-background');image.src=asset(room.image);image.alt=`${room.title}, room artwork`;image.width=width;image.height=height;world.append(image);
  for(const actor of scene.actors??[]){
    const frame=getNpcSpriteFrame({project,actor,pose:{...actor.feet,facing:actor.facing??'down',moving:false}}),sprite=make('div','review-actor');sprite.dataset.actor=actor.id;sprite.setAttribute('role','img');sprite.setAttribute('aria-label',name(actor.id));
    Object.assign(sprite.style,{left:`${actor.feet.x/width*100}%`,top:`${actor.feet.y/height*100}%`,width:`${actor.worldSize/width*100}%`,backgroundImage:`url("${asset(frame.image)}")`,backgroundSize:frame.backgroundSize,backgroundPosition:frame.backgroundPosition,aspectRatio:String(frame.aspectRatio),transform:`translate(${-frame.anchor[0]*100}%,${-frame.anchor[1]*100}%)`,zIndex:String(Math.round(actor.feet.y)+1)});world.append(sprite);
  }
  const player=project.player,at=scene.geometry.start,row=Math.max(0,player.directions.indexOf(at.facing??'up')),anchor=player.anchors[row][0],mira=make('div','review-actor');mira.dataset.actor='mira';mira.setAttribute('role','img');mira.setAttribute('aria-label','Mira');
  Object.assign(mira.style,{left:`${at.x/width*100}%`,top:`${at.y/height*100}%`,width:`${player.worldSize/width*100}%`,backgroundImage:`url("${asset(player.image??'assets/mira-walk.webp')}")`,backgroundSize:'300% 400%',backgroundPosition:`0% ${row*100/3}%`,transform:`translate(${-anchor[0]*100}%,${-anchor[1]*100}%)`,zIndex:String(Math.round(at.y))});world.append(mira);
  for(const mask of scene.occluders??[]){const foreground=make('img','room-foreground');foreground.src=asset(room.image);foreground.alt='';foreground.setAttribute('aria-hidden','true');Object.assign(foreground.style,{clipPath:mask.clipPath,zIndex:String(mask.depth)});world.append(foreground);}
  if(room.id==='depot'&&project.doors['final-route']){const lift=make('div','review-lift');lift.setAttribute('aria-hidden','true');world.append(lift);}
  $('review-preview').replaceChildren(world);scalePreview();
}
function renderTranscript(room){
  const container=$('review-transcript'),links=$('review-section-links');container.replaceChildren();links.replaceChildren();
  const value=roomState(room.id);
  for(const section of room.sections){
    const id=`review-section-${section.id}`,block=make('section','transcript-section');block.id=id;block.dataset.sectionId=section.id;block.setAttribute('aria-labelledby',id+'-title');
    const heading=make('div','transcript-heading'),title=make('h3','',section.label);title.id=id+'-title';heading.append(title,make('span','',String(section.items.length)));block.append(heading);
    const link=make('a','',section.label);link.href='#'+id;links.append(link);
    const items=make('div','transcript-items');
    for(const item of section.items){
      const itemComment=value?.items?.find(entry=>entry.id===item.id)?.comment??'',article=make('article','dialogue-item');article.dataset.itemId=item.id;article.dataset.hasComment=String(!!itemComment);
      const lineHeading=make('div','item-heading'),label=make('h4');
      if(item.speaker)label.append(make('span','speaker',name(item.speaker)));
      let displayLabel=item.label;
      if(item.speaker){const speakerName=name(item.speaker),prefix=speakerName+' · ',suffix=' · '+speakerName;if(displayLabel.startsWith(prefix))displayLabel=displayLabel.slice(prefix.length);if(displayLabel.endsWith(suffix))displayLabel=displayLabel.slice(0,-suffix.length);}
      label.append(document.createTextNode(displayLabel));
      const toggle=make('button','comment-toggle',itemComment?'Edit note':'Add note');toggle.type='button';toggle.dataset.commentToggle=item.id;toggle.setAttribute('aria-expanded',String(!!itemComment));toggle.setAttribute('aria-label',`Add or edit a comment for ${item.label}`);
      lineHeading.append(label,toggle);article.append(lineHeading,make('p','item-text',item.text));
      const comment=make('div','item-comment');comment.hidden=!itemComment;
      const fieldId='review-item-'+container.querySelectorAll('article').length+'-'+items.children.length,inputLabel=make('label','', 'Your change for this line'),textarea=make('textarea');textarea.id=fieldId;inputLabel.htmlFor=fieldId;textarea.rows=3;textarea.maxLength=MAX_REVIEW_COMMENT_LENGTH;textarea.value=itemComment;textarea.dataset.itemComment=item.id;textarea.placeholder='Describe the change you want…';comment.append(inputLabel,textarea);article.append(comment);
      toggle.addEventListener('click',()=>{comment.hidden=!comment.hidden;toggle.setAttribute('aria-expanded',String(!comment.hidden));if(!comment.hidden)textarea.focus();});
      textarea.addEventListener('input',()=>{review.setItemComment(room.id,item.id,textarea.value);article.dataset.hasComment=String(!!textarea.value.trim());toggle.textContent=textarea.value.trim()?'Edit note':'Add note';save();updateSidebar();});items.append(article);
    }
    block.append(items);container.append(block);
  }
}
function selectRoom(id,{focus=false,persist=true}={}){
  const room=catalog.find(item=>item.id===id);if(!room)return;
  activeRoomId=id;const index=catalog.indexOf(room),value=roomState(id);
  $('review-room-title').textContent=room.title;$('review-room-position').textContent=`Room ${index+1} of ${catalog.length}`;
  $('review-room-comment').value=value?.comment??'';$('review-reviewed').checked=!!value?.reviewed;
  $('review-previous').disabled=index===0;$('review-next').disabled=index===catalog.length-1;$('review-next-bottom').disabled=index===catalog.length-1;
  $('review-next-bottom').textContent=index===catalog.length-1?'Last room':'Next room →';
  renderPreview(room);renderTranscript(room);updateSidebar();
  if(persist)save();
  if(focus){if(matchMedia('(max-width:700px)').matches)$('review-room-picker').open=false;$('review-room-title').focus({preventScroll:true});$('review-main').scrollIntoView({block:'start',behavior:'instant'});}
}
function stepRoom(delta){const index=catalog.findIndex(room=>room.id===activeRoomId),room=catalog[index+delta];if(room)selectRoom(room.id,{focus:true});}
$('review-previous').addEventListener('click',()=>stepRoom(-1));$('review-next').addEventListener('click',()=>stepRoom(1));$('review-next-bottom').addEventListener('click',()=>stepRoom(1));
$('review-room-comment').addEventListener('input',()=>{review.setRoomComment(activeRoomId,$('review-room-comment').value);save();updateSidebar();});
$('review-reviewed').addEventListener('change',()=>{review.setReviewed(activeRoomId,$('review-reviewed').checked);save();updateSidebar();});
$('review-search').addEventListener('input',()=>{query=$('review-search').value.trim().toLocaleLowerCase();updateSidebar();});
for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{filter=button.dataset.filter;for(const item of document.querySelectorAll('[data-filter]'))item.setAttribute('aria-pressed',String(item===button));updateSidebar();});
$('review-export').addEventListener('click',()=>{
  try{const blob=new Blob([JSON.stringify(review.export({release}),null,2)+'\n'],{type:'application/json'});if(blob.size>5*1024*1024)throw new Error('The review is larger than 5 MB. Keep this page open and shorten the longest comments before exporting again.');const url=URL.createObjectURL(blob),link=make('a');link.href=url;link.download='coda-quiet-bell-room-review.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Comments exported. Send the downloaded JSON file back when you’re ready.');}
  catch(error){setStatus('The comments could not be exported. '+error.message,{error:true});}
});
$('review-import').addEventListener('click',()=>$('review-import-input').click());
$('review-import-input').addEventListener('change',async()=>{
  const input=$('review-import-input'),file=input.files?.[0];if(!file)return;
  try{
    if(file.size>5*1024*1024)throw new Error('Choose a review JSON file smaller than 5 MB.');
    const document=JSON.parse(await file.text());review.import(document);savingBlocked=false;
    const desired=catalog.find(room=>room.id===document.activeRoomId)?.id??activeRoomId;selectRoom(desired,{persist:false});save({message:'Comments imported and saved on this device.'});
  }catch(error){setStatus('Import failed: '+error.message+' Your current comments have been kept.',{error:true});}
  finally{input.value='';}
});
Object.defineProperty(window,'quietBellRoomReview',{value:Object.freeze({get catalog(){return catalog;},get state(){return review.state;},get activeRoomId(){return activeRoomId;},get release(){return release;},get storageAvailable(){return storageAvailable;}})});
if(globalThis.ResizeObserver){const observer=new ResizeObserver(scalePreview);observer.observe($('review-preview'));}else window.addEventListener('resize',scalePreview);
if(matchMedia('(max-width:700px)').matches)$('review-room-picker').open=false;
$('review-app').hidden=false;selectRoom(activeRoomId,{persist:false});
if(loadWarning)setStatus(loadWarning,{error:true});else setStatus(saved?'Your saved comments and checkmarks are ready.':'Your comments and checkmarks save on this device.');
