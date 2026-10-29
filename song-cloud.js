// Coda Arcade Song Machine ↔ Jukebox bridge. Uses existing Firebase project.
const inEditor=!!window.songMachineBridge;
const config=window.ARCADE_ACCOUNTS_CONFIG;
let classroomMode=config?.mode==='classroom'||config?.classroom?.privacy===true||config?.classroom?.enabled===true;
try{classroomMode=classroomMode||new URLSearchParams(location.search).get('classroom')==='1';const parent=window.parent;if(parent!==window&&parent.location.origin===location.origin){const parentConfig=parent.ARCADE_ACCOUNTS_CONFIG;classroomMode=classroomMode||parentConfig?.mode==='classroom'||parentConfig?.classroom?.privacy===true||parentConfig?.classroom?.enabled===true;}}catch{}
const supported=window.CodaArcadeHost?.supports(location.hostname)??location.hostname==='cwoodmusic.github.io';
const $=id=>document.getElementById(id);
let auth,db,api,currentUser=null,ready=false,selectedSongId=null,player=null;
let userSongs={};
const errorMessage=e=>e?.code?.includes('permission-denied')?'Firebase denied access. Add the songLibrary rules from the README.':e?.message||'Cloud connection failed.';
const validSong=s=>s&&Array.isArray(s.tracks)&&Array.isArray(s.drums)&&s.drums.length===3&&['4/4','2/4','3/4','5/4','6/8','9/8','12/8'].includes(s.meter)&&Number.isFinite(s.bpm)&&s.tracks.length<=12&&s.bars>=1&&s.bars<=16;
function editorUI(){
 const save=$('save');if(!save)return;save.textContent='♫ Save to Jukebox';save.title='Available when signed in';
 const load=$('load');if(load){load.textContent='Import Song File';}
 const container=document.createElement('span');container.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap';container.innerHTML='<button id="cloud-account" type="button">Account: Guest</button><button id="cloud-new" type="button">New Jukebox Save</button><span id="cloud-status" role="status" style="color:#a8fff2"></span>';save.after(container);
 $('cloud-new').onclick=()=>{selectedSongId=null;message('Next save will create a new song.');};
 $('cloud-account').onclick=async()=>{if(!ready)return message('Accounts connect on the published GitHub Pages site.');if(currentUser){if(confirm('Sign out of your arcade account?'))await api.signOut(auth)}else await signIn()};
 save.onclick=saveSong;
}
function message(s){const el=$('cloud-status');if(el)el.textContent=s;else if($('cloud-songs-status'))$('cloud-songs-status').textContent=s;}
async function signIn(){if(classroomMode)return message('Use your classroom sign-in card in the arcade.');try{const p=new api.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});await api.signInWithPopup(auth,p)}catch(e){message(errorMessage(e))}}
async function saveSong(){
 if(classroomMode)return message('Use Export song file to keep a copy.');
 if(!ready){message('Cloud saving works on the published arcade site.');return}
 if(!currentUser){message('Sign in with your arcade account to save.');return}
 const song=window.songMachineBridge.get();if(!validSong(song))return message('This composition cannot be saved.');
 const previous=selectedSongId&&userSongs[selectedSongId];
 const proposed=prompt('Name your song:',previous?.title||'My Song');if(proposed===null)return;
 const title=proposed.trim().slice(0,60);if(!title)return message('Please enter a song name.');
 if(previous&&!confirm('Update the existing song “'+previous.title+'”? Choose Cancel to keep it unchanged.'))return;
 const uid=currentUser.uid,id=selectedSongId||api.push(api.ref(db,'songLibrary/'+uid)).key;
 const entry={title,composition:song,updatedAt:Date.now(),createdAt:previous?.createdAt||Date.now(),version:1};
 try{await api.set(api.ref(db,'songLibrary/'+uid+'/'+id),entry);selectedSongId=id;userSongs[id]=entry;message('Saved “'+title+'” to your arcade jukebox!')}catch(e){message(errorMessage(e))}
}
function addJukeboxUI(){
 const original=jukebox.open;
 jukebox.open=()=>{original();renderLibrary()};
 const launch=$('songmachine-launch');if(launch)launch.onclick=()=>window.codaOpenSongMachine?window.codaOpenSongMachine():window.open('song-machine/index.html?v=song-89','_self');
}
async function renderLibrary(){
 if(classroomMode)return;
 const modal=$('modalbody');if(!modal)return;
 const section=document.createElement('section');section.id='cloud-song-library';
 section.innerHTML='<h3>♫ My Songs</h3><p id="cloud-songs-status" class="cloud-song-message"></p><div id="cloud-song-list"></div><button id="cloud-compose" type="button">♫ Create a Song</button>';
 modal.append(section);
 $('cloud-compose').onclick=()=>window.codaOpenSongMachine?window.codaOpenSongMachine():window.open('song-machine/index.html?v=song-89','_self');
 if(!ready){message('Sign in and cloud songs are available on the published GitHub Pages arcade.');return}
 if(!currentUser){message('Sign in with your arcade account to see your songs.');const b=document.createElement('button');b.textContent='Sign in with Google';b.onclick=signIn;section.append(b);return}
 message('Loading your songs…');
 try{
 const uid=currentUser.uid,snap=await api.get(api.ref(db,'songLibrary/'+uid));if(!currentUser||currentUser.uid!==uid||!$('cloud-song-list'))return;
 userSongs=snap.val()||{};const list=$('cloud-song-list');list.replaceChildren();
 const entries=Object.entries(userSongs).filter(([,v])=>validSong(v?.composition)).sort((a,b)=>(b[1].updatedAt||0)-(a[1].updatedAt||0));
 message(entries.length?entries.length+' saved song'+(entries.length===1?'':'s'):'Your jukebox is waiting for its first song!');
 for(const [id,song] of entries){
 const row=document.createElement('div');row.className='cloud-song-row';const title=document.createElement('strong');title.textContent=song.title;
 const info=document.createElement('small');info.textContent=song.composition.meter+' · '+song.composition.bpm+' BPM';
 const play=document.createElement('button');play.textContent='▶ Play';play.onclick=()=>playComposition(song.composition,song.title);
 const edit=document.createElement('button');edit.textContent='✎ Edit';edit.onclick=()=>window.codaOpenSongMachine?window.codaOpenSongMachine(id):window.open('song-machine/index.html?song='+encodeURIComponent(id)+'&v=song-89','_self');
 const del=document.createElement('button');del.textContent='Delete';del.onclick=async()=>{if(!confirm('Delete “'+song.title+'” from your jukebox?'))return;try{stopComposition();await api.remove(api.ref(db,'songLibrary/'+uid+'/'+id));renderLibrary()}catch(e){message(errorMessage(e))}};
 row.append(title,info,play,edit,del);list.append(row);
 }
 }catch(e){message(errorMessage(e))}
}
function stopComposition(){if(player){player.stop();player=null}}
function playComposition(song,title){
 if(!validSong(song))return;
 jukebox.stop();stopComposition();
 const C=window.AudioContext||window.webkitAudioContext;if(!C)return message('Audio is unavailable.');
 const ctx=new C(),sources=[];let stopped=false;
 const sec=60/song.bpm/4,start=ctx.currentTime+.05;
 function tone(p,t,d,sound,vol){const osc=ctx.createOscillator(),gain=ctx.createGain();const freq=440*2**((p-69)/12);osc.type=['square','triangle','triangle','sine','sawtooth','sawtooth','sine','triangle','square','sawtooth'][sound]||'triangle';osc.frequency.value=sound===3?freq*2:freq;const end=t+Math.max(.045,d);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,vol*.14),t+.008);gain.gain.setValueAtTime(Math.max(.0002,vol*.12),Math.max(t+.01,end-.04));gain.gain.exponentialRampToValueAtTime(.0001,end);osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(end+.01);sources.push(osc)}
 function drum(row,kind,t,vol){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=row===0?'sine':'triangle';osc.frequency.setValueAtTime(row===0?110:row===1?200:950,t);osc.frequency.exponentialRampToValueAtTime(row===0?45:row===1?100:600,t+.13);gain.gain.setValueAtTime(Math.max(.001,vol*.2),t);gain.gain.exponentialRampToValueAtTime(.001,t+.15);osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+.16);sources.push(osc)}
 for(const tr of song.tracks){if(tr.mute)continue;for(const n of tr.notes||[]){if(n.t>=song.bars*stepsPerBar(song.meter))continue;tone(n.p,start+n.t*sec,n.d*sec*.94,tr.sound,tr.volume)}}
 for(let i=0;i<3;i++){const tr=song.drums[i];if(tr.mute)continue;for(const n of tr.notes||[])if(n.t<song.bars*stepsPerBar(song.meter))drum(i,tr.sound,start+n.t*sec,tr.volume)}
 const duration=song.bars*stepsPerBar(song.meter)*sec;
 player={stop(){if(stopped)return;stopped=true;for(const o of sources)try{o.stop()}catch{}ctx.close().catch(()=>{})}};
 message('Playing “'+title+'”');setTimeout(()=>{if(!stopped&&player){stopComposition();message('Finished “'+title+'”')}},(duration+.2)*1000);
}
function stepsPerBar(meter){const [n,d]=meter.split('/').map(Number);return n*16/d}
async function openRequestedSong(){if(classroomMode)return;const id=new URLSearchParams(location.search).get('song');if(!id||!currentUser)return;try{const snap=await api.get(api.ref(db,'songLibrary/'+currentUser.uid+'/'+id));const record=snap.val();if(!validSong(record?.composition))return message('That song was not found.');window.songMachineBridge.load(record.composition);selectedSongId=id;userSongs[id]=record;message('Editing “'+record.title+'”. Save to update it.')}catch(e){message(errorMessage(e))}}
if(classroomMode&&inEditor){const save=$('save');if(save){save.textContent='Export song file';save.title='Keep a copy of your song';save.disabled=false;}const load=$('load');if(load)load.textContent='Import song file';}
else if(!classroomMode){if(inEditor)editorUI();else addJukeboxUI();}
if(!classroomMode&&supported&&config?.enabled){
 try{const [app,authApi,databaseApi]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js')]);
 api={...authApi,...databaseApi};const firebaseApp=app.initializeApp(config.firebase,'arcade-profiles');auth=api.getAuth(firebaseApp);db=api.getDatabase(firebaseApp);await api.setPersistence(auth,api.browserLocalPersistence);ready=true;
 api.onAuthStateChanged(auth,u=>{currentUser=u;if(inEditor){$('cloud-account').textContent=u?'Account: Signed in':'Account: Guest';$('save').disabled=!u;if(u)openRequestedSong();else message('Sign in to save to your jukebox.')}else if($('cloud-song-library'))renderLibrary()});
 }catch(e){message('Firebase connection failed: '+errorMessage(e))}
}else if(inEditor&&!classroomMode){$('save').disabled=true;message('Publish on GitHub Pages to enable cloud saving.');}
