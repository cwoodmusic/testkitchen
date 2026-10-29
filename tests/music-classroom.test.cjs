const test=require('node:test');
const assert=require('node:assert/strict');
const {TOPICS,SHELVES,HAYDN,topicFor}=require('../music-classroom.js');
test('Haydn, every bookshelf and all interactive lessons have useful study content',()=>{
  assert.equal(HAYDN.name,'Professor Haydn');
  assert.equal(SHELVES.length,3);
  const ids=new Set(TOPICS.map(topic=>topic.id));assert.equal(ids.size,TOPICS.length);assert.ok(TOPICS.length>=14);
  for(const id of ['welcome','pitch-race','music-triad','rhythm-room','pitch','staff','intervals','triads','rhythm','meter','piano','song-machine','note-naming','rhythm-tree','time-signatures','bass-clef','grand-staff','major-minor-keys','dynamics','tempo','accidentals-key-signatures','final-exam'])assert.ok(ids.has(id),id);
  for(const shelf of SHELVES){assert.ok(ids.has(shelf.topic));assert.ok(shelf.approach.y>=285&&shelf.approach.y<=565);}
  for(const topic of TOPICS){
    assert.ok(topic.title&&topic.html,topic.id);
    if(!topic.tutorial&&!topic.exam&&!topic.supplemental){
      assert.ok(topic.html.length>160,'A guide needs an explanation, not just a title: '+topic.id);
      assert.ok(topic.quiz.answers.length>=3);assert.ok(topic.quiz.correct>=0&&topic.quiz.correct<topic.quiz.answers.length);assert.ok(topic.quiz.explanation);
    }
    assert.equal(topicFor(topic.id),topic);
    const visible=topic.html.replace(/<[^>]*>/g,' ')+' '+JSON.stringify(topic.quiz||{});
    assert.doesNotMatch(visible,/\b[A-G][♯♭]?[0-8]\b/,'Young learners should see letter names without octave digits: '+topic.id);
  }
  assert.equal(topicFor('bad-id').id,'welcome');
  assert.equal(topicFor('final-exam').exam,true);assert.equal(topicFor('final-exam').tutorial,undefined,'An exam is separate from the eight teaching lessons');
});
test('classroom covers all cabinets and both Chopin game types accurately',()=>{
  const all=TOPICS.map(topic=>topic.title+' '+topic.html).join(' ');
  for(const game of ['Pitch Race','Music Triad','Rhythm Room','Song Machine','Piano Lab'])assert.ok(all.includes(game));
  assert.match(topicFor('music-triad').html,/Notes battle notes/i);assert.match(topicFor('music-triad').html,/Rests battle rests/i);
  assert.match(topicFor('music-triad').html,/3 × 3/);
  assert.match(topicFor('piano').html,/walking (?:is silent|stays quiet)/i);assert.match(topicFor('piano').html,/<strong>E/);assert.match(topicFor('piano').html,/major or natural minor/);assert.match(topicFor('piano').html,/back down/);assert.match(topicFor('piano').html,/memory challenge/);
  assert.match(topicFor('intervals').html,/half step/i);assert.match(topicFor('intervals').html,/starting key/i);
  assert.match(topicFor('meter').html,/6\/8/);assert.match(topicFor('meter').html,/two big beats/i);
  assert.match(topicFor('song-machine').html,/sixteen|16/i);assert.match(topicFor('song-machine').html,/one bar/i);
  assert.match(topicFor('rhythm').html,/quarter note.*one beat/i);
});
test('listening examples use valid pitches and distinguish chords from melodies',()=>{
  const examples=TOPICS.flatMap(topic=>topic.audio||[]);assert.ok(examples.length>=6);
  assert.ok(examples.some(example=>example.chord));assert.ok(examples.some(example=>!example.chord));
  for(const example of examples){assert.ok(example.label);assert.ok(example.notes.length>=2);assert.ok(example.notes.every(note=>Number.isInteger(note)&&note>=48&&note<=84));}
});
