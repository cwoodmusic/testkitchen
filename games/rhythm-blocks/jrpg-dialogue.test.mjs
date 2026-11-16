import test from 'node:test';
import assert from 'node:assert/strict';
import {wrapDialogue} from './jrpg-dialogue.mjs';

test('word wrapping preserves all source characters and explicit line breaks',()=>{
 for(const text of ['A repaired bell still has a reply.','One\nTwo\nThree','Averylongwordthatneedsbreaking','A  careful question.','🌟 A curious answer…'])for(const columns of [1,7,25]){
  const rows=wrapDialogue(text,columns);
  assert.equal(rows.map(row=>Array.from(text).slice(row.start,row.end).join('')).join(''),text);
  assert(rows.every(row=>Array.from(row.text).length<=columns));
 }
 assert.deepEqual(wrapDialogue('',20),[{text:'',start:0,end:0}]);
});
