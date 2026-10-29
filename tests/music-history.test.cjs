const test=require('node:test'),assert=require('node:assert/strict');
const history=require('../music-history.js'),profiles=require('../classroom-profile-data.js'),visitors=require('../npc-visitors.js');
function fixture(){const values=new Map();let near=true,allowed=true,owner='guest',fail=false;const storage={getItem:key=>values.get(key)??null,setItem(key,value){if(fail)throw Error('quota');values.set(key,value);},removeItem:key=>values.delete(key)};const store=history.createStore({storage,canTalk:()=>near,canUse:()=>allowed,getIdentity:()=>owner});return {store,storage,values,setNear:v=>near=v,setAllowed:v=>allowed=v,setOwner:v=>owner=v,setFail:v=>fail=v};}
test('18 eligible characters have 30 unique digestible entries each; excluded attendants have none',()=>{
 assert.equal(Object.keys(history.PEOPLE).length,18);const ids=[];
 for(const [id,person]of Object.entries(history.PEOPLE)){assert.equal(person.facts.length,30,id);for(const fact of person.facts){ids.push(fact.id);assert.ok(fact.text.length>=15&&fact.text.length<240,fact.id);assert.ok(fact.id.startsWith(id+'-'));}}
 assert.equal(new Set(ids).size,540);for(const id of ['shop','boutique','captain','captain-cadence','__proto__','constructor'])assert.equal(Object.hasOwn(history.PEOPLE,id),false);
 for(const visitor of visitors.profiles)assert.ok(Object.hasOwn(history.PEOPLE,visitor.id));
});
test('locked snapshots expose no undiscovered text and discovering unlocks exactly one entry',()=>{
 const {store,values}=fixture();let state=store.snapshot();assert.equal(state.total,540);assert.equal(state.count,0);assert.ok(state.people.every(person=>person.facts.every(fact=>fact.locked&&!Object.hasOwn(fact,'text'))));
 const first=store.discover('bach');assert.equal(first.fact.id,'bach-01');state=store.snapshot();assert.equal(state.count,1);assert.equal(state.people[0].facts[0].text,first.fact.text);assert.equal(Object.hasOwn(state.people[0].facts[1],'text'),false);assert.deepEqual(JSON.parse(values.get(history.KEY)),{version:1,discovered:['bach-01']});
});
test('all entries unlock without repeats and completion never changes the journal',()=>{
 const {store,values}=fixture();for(let at=0;at<30;at++){const result=store.discover('haydn');assert.equal(result.count,at+1);assert.ok(result.fact.id.endsWith(String(at+1).padStart(2,'0')));}
 const before=values.get(history.KEY);assert.equal(store.discover('haydn').complete,true);assert.equal(values.get(history.KEY),before);assert.equal(store.snapshot().count,30);
});
test('proximity, profile permission and failed writes leave entries locked and retryable',()=>{
 const f=fixture();f.setNear(false);assert.equal(f.store.discover('miles').ok,false);assert.equal(f.store.snapshot().count,0);
 f.setNear(true);f.setAllowed(false);assert.equal(f.store.discover('miles').ok,false);f.setAllowed(true);f.setFail(true);assert.equal(f.store.discover('miles').ok,false);assert.equal(f.store.snapshot().count,0);f.setFail(false);assert.equal(f.store.discover('miles').fact.id,'miles-01');
 for(const id of ['captain-cadence','__proto__','constructor'])assert.equal(f.store.discover(id).ok,false);
 const unsafe=history.createStore({storage:f.storage});assert.equal(unsafe.discover('bach').ok,false);
});
test('reloads and separate store instances preserve discoveries, while corrupt saves are never overwritten',()=>{
 const f=fixture();f.store.discover('ella');const other=history.createStore({storage:f.storage,canTalk:()=>true});assert.equal(other.discover('ella').fact.id,'ella-02');assert.equal(f.store.snapshot().count,2);
 for(const value of ['bad JSON',JSON.stringify({version:1,discovered:['not-a-fact']}),JSON.stringify({version:2,discovered:[]})]){f.values.set(history.KEY,value);assert.equal(f.store.snapshot().ok,false);assert.equal(f.store.discover('ella').ok,false);assert.equal(f.values.get(history.KEY),value);}
});
test('a player change during a discovery cannot write into the next player',()=>{
 const f=fixture();let owner='first';const store=history.createStore({storage:f.storage,getIdentity:()=>owner,canTalk:()=>{owner='second';return true;}});assert.equal(store.discover('bach').ok,false);assert.equal(f.values.has(history.KEY),false);
});
test('journal participates in local player isolation and older backups remain restorable',()=>{
 const f=fixture();f.store.discover('chopin');const backup=profiles.backup(f.storage);assert.ok(profiles.LOCAL_ONLY_KEYS.includes(history.KEY));assert.equal(profiles.clear(f.storage).ok,true);assert.equal(f.store.snapshot().count,0);assert.equal(profiles.restore(f.storage,backup).ok,true);assert.equal(f.store.snapshot().count,1);
 delete backup.values[history.KEY];assert.equal(profiles.restore(f.storage,backup).ok,true);assert.equal(f.store.snapshot().count,0);
 const uploaded=profiles.capture(f.storage);assert.ok(!JSON.stringify(uploaded).includes(history.KEY));
});
