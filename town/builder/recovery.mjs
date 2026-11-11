import {getSavedProjects,saveProject} from '../world/storage.mjs?v=town-polish-1';
import {parseProject} from '../world/model.mjs?v=town-polish-1';

const uploadedURL=new URL('../maps/coda-town-uploaded-3.json',import.meta.url);
const isBlank=doc=>!doc.objects.length&&!Object.keys(doc.cells).length&&!Object.keys(doc.edges).length;

// Recovery is explicit and reads the original stored value before replacing
// anything. An unreadable startup cannot become a blank autosave or Play save.
export function createTownRecovery({getDatabase,getProject,install,ids,prepare,download,status}){
 let blocked=false,snapshot=null,busy=false;
 const panel=document.createElement('section');panel.id='recoveryPanel';panel.hidden=true;panel.setAttribute('aria-label','Recover your town');
 panel.innerHTML='<h2>Recover your town</h2><p id="recoveryMessage"></p><p id="currentSaveInfo"></p><div class="recovery-actions"><button id="recoverUploaded">Restore uploaded town · 120 assets</button><a id="downloadUploaded" href="'+uploadedURL.href+'" download="coda-town-uploaded-3.json">Download uploaded map · JSON</a><button id="downloadStored" hidden>Download this browser’s saved data</button></div><h3>Previous browser saves</h3><div id="savedBackups"></div><p id="recoveryError" role="status"></p><button id="closeRecovery">Close recovery</button>';
 document.getElementById('viewport').append(panel);
 const $=id=>panel.querySelector('#'+id);
 function message(text){$('recoveryMessage').textContent=text;}
 function rawDownload(record){
  const text=record.text??JSON.stringify(record.raw,null,2);
  download(new Blob([text],{type:'application/json'}),record.key==='current'?'coda-town-browser-save.json':'coda-town-browser-backup.json');
 }
 async function refresh(){
  if(getDatabase())snapshot=await getSavedProjects(getDatabase());
  const current=snapshot?.current;
  $('currentSaveInfo').textContent=current?current.readable?`This browser: ${current.name} · ${current.objects} assets`:'This browser contains saved data that could not be opened. It has been kept unchanged.':'No saved town was found on this site in this browser.';
  $('downloadStored').hidden=!current;$('downloadStored').onclick=()=>rawDownload(current);
  const list=$('savedBackups');list.replaceChildren();
  for(const record of snapshot?.backups||[]){
   const row=document.createElement('div'),restore=document.createElement('button'),exportButton=document.createElement('button');
   restore.textContent=`Restore ${record.name}${record.objects!==null?' · '+record.objects+' assets':''}${record.capturedAt?' · '+new Date(record.capturedAt).toLocaleString():''}`;restore.disabled=!record.readable;
   restore.onclick=()=>run(async()=>{const next=parseProject(record.text,ids);await replace(next);});
   exportButton.textContent='Download';exportButton.onclick=()=>rawDownload(record);row.append(restore,exportButton);list.append(row);
  }
  if(!list.childNodes.length){const p=document.createElement('p');p.textContent='No previous browser saves are available yet.';list.append(p);}
 }
 async function open(text){panel.hidden=false;if(text)message(text);try{await refresh();}catch(e){$('recoveryError').textContent='Browser storage could not be read. The uploaded map is still available to open or download.';}}
 async function run(action){
  if(busy)return;busy=true;panel.hidden=false;status('Opening map backup…');$('recoverUploaded').disabled=true;$('recoveryError').textContent='Opening map…';
  try{await action();$('recoveryError').textContent='';}catch(e){$('recoveryError').textContent=e.message;status('Recovery could not finish. Existing saved data is unchanged.');}
  finally{busy=false;$('recoverUploaded').disabled=false;}
 }
 async function replace(next,{initial=false}={}){
  await prepare(next);
  const db=getDatabase();
  if(db)await saveProject(db,next,{replaceUnreadable:true});
  install(next,{initial});blocked=!db;
  status(db?'Restored your town · '+next.objects.length+' assets':'Map opened in this tab. Browser storage is unavailable; use Save project to keep a copy.');
  if(db)panel.hidden=true;else{panel.hidden=false;message('Your map is open. Download a project copy because this browser cannot save it.');}
  return next;
 }
 async function restoreUploaded(){
  const response=await fetch(uploadedURL,{cache:'no-cache'});if(!response.ok)throw Error('The uploaded backup could not be downloaded. Please try again.');
  const next=parseProject(await response.text(),ids);await replace(next);return next;
 }
 $('recoverUploaded').onclick=()=>run(restoreUploaded);
 $('closeRecovery').onclick=()=>{panel.hidden=true;};
 document.getElementById('recover').onclick=()=>open('Browser saves stay with the site and browser where you built the town. You can restore a previous save or the last map you uploaded.');
 async function loadInitial(databaseError){
  const requested=new URLSearchParams(location.search).get('recover')==='uploaded-3';
  try{
   if(databaseError)throw databaseError;
   snapshot=await getSavedProjects(getDatabase());
   if(snapshot.current){
    const next=parseProject(snapshot.current.text,ids);await prepare(next);install(next,{initial:true,fit:false});
    status('Restored your saved town');
    if(requested&&!isBlank(next)){await open('Your existing saved town is loaded. The uploaded backup is available below if you want to restore it.');return;}
   }else status('Blank grass map · no browser save found');
   if(requested){await run(restoreUploaded);}
  }catch(e){
   blocked=true;status('Saved town could not load. Its stored data is unchanged. Use Recover map.');
   await open('The saved town could not be opened. Its stored data has been kept unchanged. Download it or choose a backup to restore.');
   $('recoveryError').textContent=e.message;
  }
 }
 return {loadInitial,open,replace,refresh,get writeBlocked(){return blocked;},get savedProjects(){return snapshot;}};
}
