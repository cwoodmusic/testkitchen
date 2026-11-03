'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const quotes=require('../npc-quotes.js');
function setup(getDialogue){
 const window={},context=vm.createContext({window});
 for(const file of ['npc-visitors.js','npc-quotes.js','npc-behavior.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 const npcs=window.CodaMusicianCast.map(person=>({...person,x:100,y:100,userPlaced:true}));
 return {window,npcs,engine:window.createCodaNPCBehavior({npcs,inside:()=>true,route:()=>[],getDialogue,getGames:()=>[],getPlayer:()=>({x:-999,y:-999}),isUnlocked:()=>true})};
}
test('every historical visitor has a plain greeting and just one simple advice choice',()=>{
 const {npcs,engine}=setup();
 for(const person of npcs.filter(p=>!p.fictional)){
  const data=engine.beginConversation(person.id);assert.equal(data.line,quotes.line(person.id));if(quotes.get(person.id).kind==='quotation')assert.equal(data.quotation.source,quotes.get(person.id).source);else assert.equal(data.quotation,null);
  assert.equal(data.choices.length,1);assert.equal(data.choices[0].label,'Advice');assert.equal(engine.say(person.id,'advice'),quotes.advice(person.id));
  assert.ok(engine.say(person.id,'music').length>20);assert.equal(engine.getConversation(person.id).quotation,null);
  assert.ok(engine.say(person.id,'advice').length>20);assert.ok(engine.say(person.id,'games').length>20);engine.endConversation();
 }
 for(const id of ['vee-jay','zizi','metronome']){assert.equal(quotes.get(id),null);assert.equal(engine.getConversation(id).choices.length,1);assert.equal(engine.getConversation(id).quotation,null);}
 assert.equal(quotes.get('__proto__'),null);
});
test('edited dialogue is respected and an edited quotation is never credited as historical',()=>{
 let edited;const {window,engine}=setup(()=>edited);edited=JSON.parse(JSON.stringify(window.CodaNPCDialogueDefaults.bach));
 edited.greetings=['Hello from the author.'];edited.choices[0].reply='A newly imagined line.';
 assert.equal(engine.beginConversation('bach').line,'Hello from the author.');assert.equal(engine.getConversation('bach').quotation,null);
 assert.equal(engine.say('bach','advice'),'A newly imagined line.');assert.equal(engine.getConversation('bach').quotation,null);
});
test('Bach’s published greeting is authored dialogue and does not restore removed choices',()=>{
 const entry=require('../published-world-project.json').dialogue.bach;
 const editor=require('../dialogue-editor.js');assert.equal(editor.validEntry(entry),true);
 const {engine}=setup(id=>id==='bach'?entry:null);
 const data=engine.beginConversation('bach');assert.equal(data.line,quotes.get('bach').text);assert.equal(data.quotation,null);
 assert.deepEqual(Array.from(data.choices,c=>c.id),['advice']);
 assert.equal(engine.say('bach','advice'),quotes.advice('bach'));
 assert.equal(engine.getConversation('bach').quotation,null);
});
test('quotes cover the two room musicians and keep source and translation context beside G-rated words',()=>{
 assert.equal(Object.keys(quotes.byId).length,14);
 for(const entry of Object.values(quotes.byId)){
  assert.ok(entry.text.length>0&&entry.source.length>30&&entry.note.length>20);assert.match(entry.text,/^[A-Z].*[.!?]$/);assert.doesNotMatch(entry.text,/\b(conservative|radical|politic(?:s|al)?|ninety-four)\b/i);if(entry.kind==='quotation')assert.match(entry.url,/^https:\/\//);else{assert.equal(entry.kind,'authored');assert.match(entry.note,/not a historical quotation/);}
  assert.doesNotMatch(entry.text,/\b(god|jesus|christ|heaven|hell|religion|church|damn|shit|fuck)\b/i);
 }
 assert.match(quotes.credit('chopin'),/Niecks/);assert.equal(quotes.get('haydn').kind,'authored');
 const html=fs.readFileSync(path.join(__dirname,'../world-preview.html'),'utf8');assert.ok(html.indexOf('npc-quotes.js?')<html.indexOf('npc-behavior.js?'));
});
test('the four uploaded history fact edits appear in the resolved game content',()=>{
 const project=require('../published-world-project.json'),history=require('../music-history-content.js');assert.equal(history.validate(project.musicHistoryContent),true);
 const facts=history.resolvePeople(project.musicHistoryContent);
 assert.equal(facts.beethoven.facts[2].text,'Beethoven became known in Vienna for playing piano.');
 assert.equal(facts.beethoven.facts[4].text,'Beethoven’s Fifth Symphony starts with a short musical idea called a "motif."');
 assert.equal(facts.clara.facts[3].text,'Clara started her Piano Concerto in A minor as a teen. In a concerto, one instrument is featured alongside with an orchestra.');
 assert.equal(facts.joplin.facts[2].text,'Ragtime often puts strong notes between the main beats. Another part keeps a steady beat. This is called syncopation.');
});
