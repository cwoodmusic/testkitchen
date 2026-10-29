const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const editor=require('../dialogue-editor.js'),sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../npc-behavior.js'),'utf8'),sandbox);
const defaults=JSON.parse(JSON.stringify(sandbox.window.CodaNPCDialogueDefaults));
const clone=value=>JSON.parse(JSON.stringify(value));

test('all authored musician defaults are editable and old projects may have no overrides',()=>{
 assert.equal(Object.keys(defaults).length,12);assert.equal(editor.validate({},defaults),true);
 assert.equal(editor.validate(defaults,defaults),true);assert.equal(editor.validate(undefined,defaults),false);
 for(const entry of Object.values(defaults))assert.equal(editor.validEntry(entry),true);
});

test('dialogue resolution clones overrides and defaults without mutating authored content',()=>{
 const first=editor.resolved(defaults,{},'bach');first.greetings[0]='A private edit';
 assert.notEqual(defaults.bach.greetings[0],first.greetings[0]);
 const override={bach:first},resolved=editor.resolved(defaults,override,'bach');resolved.choices.pop();
 assert.notEqual(resolved.choices.length,first.choices.length);assert.equal(editor.resolved(defaults,{},'unknown'),null);
});

test('custom replies support add reorder and delete while duplicate or reserved IDs fail',()=>{
 const entry=clone(defaults.bach);entry.choices.push({id:'custom-1',label:'What is timbre?',reply:'Timbre is the quality of a sound.'});
 assert.equal(editor.validEntry(entry),true);entry.choices.reverse();assert.equal(editor.validEntry(entry),true);
 entry.choices.push(clone(entry.choices[0]));assert.equal(editor.validEntry(entry),false);entry.choices.pop();
 entry.choices[0].id='greeting';assert.equal(editor.validEntry(entry),false);
 entry.choices=[];assert.equal(editor.validEntry(entry),true,'A greeting-only conversation is allowed');
});

test('known IDs and bounded plain data prevent malformed or oversized imports',()=>{
 assert.equal(editor.validate({stranger:defaults.bach},defaults),false);
 assert.equal(editor.validate(JSON.parse('{"__proto__":{}}'),defaults),false);
 for(const change of [entry=>entry.greetings=[],entry=>entry.greetings=Array(9).fill('Hi'),entry=>entry.greetings[0]='x'.repeat(501),entry=>entry.description='x'.repeat(1001),entry=>entry.choices[0].label='',entry=>entry.choices[0].reply='x'.repeat(1201),entry=>entry.extra='unsupported']){
  const entry=clone(defaults.bach);change(entry);assert.equal(editor.validate({bach:entry},defaults),false);
 }
});

test('only the activity choice may keep an empty dynamic reply, and text remains text',()=>{
 const entry=clone(defaults.bach),activity=entry.choices.find(choice=>choice.id==='activity');activity.reply='';assert.equal(editor.validEntry(entry),true);
 entry.choices.find(choice=>choice.id==='music').reply='';assert.equal(editor.validEntry(entry),false);
 entry.choices.find(choice=>choice.id==='music').reply='<img src=x onerror="steal()">';assert.equal(editor.validEntry(entry),true,'DOM rendering must use textContent instead of evaluating text');
});
