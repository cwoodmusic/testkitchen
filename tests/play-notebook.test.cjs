const test=require('node:test'),assert=require('node:assert/strict');
const notes=require('../play-notebook.js'),profiles=require('../classroom-profile-data.js');
function disk(initial={}){const values=new Map(Object.entries(initial));return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
test('play notes save exact free text locally and reopen without changing other progress',()=>{
 const storage=disk({sentinel:'keep'}),text='Bug: the room door\nFuture idea: jazz café <script>do not run</script>';
 const pad=notes.createStore({storage,now:()=>1234});assert.equal(pad.load().saved,true);assert.equal(pad.setText(text),true);assert.equal(pad.getState().dirty,true);
 assert.equal(pad.save().ok,true);assert.deepEqual(JSON.parse(storage.getItem(notes.KEY)),{version:1,text,updatedAt:1234});assert.equal(storage.getItem('sentinel'),'keep');
 const again=notes.createStore({storage});assert.equal(again.load().text,text);assert.equal(again.save().ok,true);assert.equal(again.getState().dirty,false);
 assert.equal(notes.formatNotes(text),'Coda Arcade — play notes\n\n'+text+'\n');
});
test('notes from an old player cannot save into a new player or a paused profile',()=>{
 const storage=disk();let identity='a',allowed=true;const pad=notes.createStore({storage,getIdentity:()=>identity,canRecord:()=>allowed});
 pad.load();pad.setText('Old player draft');identity='b';storage.setItem(notes.KEY,JSON.stringify({version:1,text:'New player',updatedAt:100}));
 assert.equal(pad.save().ok,false);assert.equal(JSON.parse(storage.getItem(notes.KEY)).text,'New player');
 pad.load();pad.setText('New draft');allowed=false;assert.equal(pad.save().ok,false);assert.equal(JSON.parse(storage.getItem(notes.KEY)).text,'New player');
});
test('failed writes and unreadable stores retain a truthful unsaved draft without overwriting existing notes',()=>{
 const storage=disk({[notes.KEY]:JSON.stringify({version:1,text:'Saved',updatedAt:1})}),pad=notes.createStore({storage});pad.load();pad.setText('Draft');
 storage.setItem=()=>{throw Error('quota');};assert.equal(pad.save().ok,false);assert.equal(pad.getState().text,'Draft');assert.equal(pad.getState().saved,false);assert.match(pad.getState().error,/not saved/);assert.equal(JSON.parse(storage.getItem(notes.KEY)).text,'Saved');
 for(const source of ['not JSON',JSON.stringify({version:9,text:'unknown',updatedAt:0})]){
  const saved=disk({[notes.KEY]:source}),bad=notes.createStore({storage:saved});assert.equal(bad.load().saved,false);bad.setText('Still downloadable');assert.equal(bad.save().ok,false);assert.equal(saved.getItem(notes.KEY),source);
 }
 const blocked=notes.createStore({storage:{getItem(){throw Error('blocked');}}});assert.equal(blocked.load().saved,false);assert.equal(blocked.setText('Local draft'),true);assert.equal(blocked.save().ok,false);
});
test('another tab replacing saved notes prevents an unsaved draft from overwriting them',()=>{
 const storage=disk(),a=notes.createStore({storage}),b=notes.createStore({storage});a.load();b.load();a.setText('A');assert.equal(a.save().ok,true);b.setText('B');assert.equal(b.save().ok,false);assert.equal(JSON.parse(storage.getItem(notes.KEY)).text,'A');assert.match(b.getState().error,/another tab/);
});
test('bounded drafts and a reset never retain the previous player text',()=>{
 const pad=notes.createStore({storage:disk()});pad.load();assert.equal(pad.setText('x'.repeat(notes.MAX_LENGTH+1)),false);assert.equal(pad.getState().text,'');pad.setText('private draft');pad.reset();assert.equal(pad.getState().text,'');assert.equal(pad.getState().loaded,false);assert.equal(pad.setText('must load first'),false);
});
test('notebook and randomized quiz attempts stay out of cloud profiles but follow local workspace backup/restore',()=>{
 const storage=disk(),text=JSON.stringify({version:1,text:'Bug notes never upload',updatedAt:1}),attempts=JSON.stringify({version:1,attempt:'local only'});
 storage.setItem(notes.KEY,text);storage.setItem('codaClassroomQuizAttemptsV1',attempts);
 for(const key of [notes.KEY,'codaClassroomQuizAttemptsV1']){assert.ok(profiles.LOCAL_ONLY_KEYS.includes(key));assert.ok(profiles.SCOPED_KEYS.includes(key));assert.ok(!Object.values(profiles.KEYS).includes(key));}
 const backup=profiles.backup(storage);assert.equal(backup.localOnly,true);assert.equal(backup.values[notes.KEY],text);assert.equal(backup.values.codaClassroomQuizAttemptsV1,attempts);
 const captured=profiles.capture(storage);assert.equal(captured.ok,true);assert.ok(!JSON.stringify(captured.data).includes('Bug notes never upload'));assert.ok(!JSON.stringify(captured.data).includes('local only'));
 assert.equal(profiles.apply(storage,profiles.blank()).ok,true);assert.equal(storage.getItem(notes.KEY),null);assert.equal(storage.getItem('codaClassroomQuizAttemptsV1'),null);
 assert.equal(profiles.restore(storage,backup).ok,true);assert.equal(storage.getItem(notes.KEY),text);assert.equal(storage.getItem('codaClassroomQuizAttemptsV1'),attempts);
 const legacy=structuredClone(backup);delete legacy.values[notes.KEY];delete legacy.values.codaClassroomQuizAttemptsV1;assert.equal(profiles.restore(storage,legacy).ok,true);assert.equal(storage.getItem(notes.KEY),null);
});
