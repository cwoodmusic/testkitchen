import test from 'node:test';
import assert from 'node:assert/strict';
import {wrapDialogue,dialogueRevealTimes,dialogueDurationMs} from './jrpg-dialogue.mjs';

test('word wrapping preserves all source characters and explicit line breaks',()=>{
 for(const text of ['A repaired bell still has a reply.','One\nTwo\nThree','Averylongwordthatneedsbreaking','A  careful question.','🌟 A curious answer…'])for(const columns of [1,7,25]){
  const rows=wrapDialogue(text,columns);
  assert.equal(rows.map(row=>Array.from(text).slice(row.start,row.end).join('')).join(''),text);
  assert(rows.every(row=>Array.from(row.text).length<=columns));
 }
 assert.deepEqual(wrapDialogue('',20),[{text:'',start:0,end:0}]);
});

test('the typewriter gives punctuation a natural pause without changing authored text',()=>{
 const times=dialogueRevealTimes('Hi, there!');
 assert.deepEqual(times,[0,32,64,184,202,234,266,298,330,362]);
 assert.equal(dialogueDurationMs('Hi, there!'),362);
 assert(dialogueRevealTimes('Wait. Really?')[6]-dialogueRevealTimes('Wait. Really?')[5]<100,'A pause occurs at punctuation, not again after its following space.');
 assert.equal(dialogueRevealTimes('Wait. Really?')[5]-dialogueRevealTimes('Wait. Really?')[4],240);
 assert.equal(dialogueRevealTimes('Well… yes.')[5]-dialogueRevealTimes('Well… yes.')[4],320);
 assert.deepEqual(dialogueRevealTimes(''),[]);assert.equal(dialogueDurationMs(''),0);
});
