import test from 'node:test';
import assert from 'node:assert/strict';
import {STORY_INTRO_PARAGRAPHS,storyIntroDurationMs,createStoryIntroClock} from './story-intro.mjs';

test('the prologue explains the town, practical stakes, mystery and player goal',()=>{
 assert.equal(STORY_INTRO_PARAGRAPHS.length,3);assert(Object.isFrozen(STORY_INTRO_PARAGRAPHS));
 const [town,mystery,goal]=STORY_INTRO_PARAGRAPHS;
 assert.match(town,/floating islands/);assert.match(town,/reply: “I got your message[.]”/);
 for(const need of ['Mail and supplies are stuck','gardens need water','landing is safe'])assert(town.includes(need));
 assert.match(mystery,/letter returns/);assert.match(mystery,/warm wax/);assert.match(mystery,/routes are closed/);
 assert.match(goal,/You play as Mira/);assert.match(goal,/talk to your friends/);assert.match(goal,/musical notes/);
 assert(!/loose|broken wire|metal clip/.test(STORY_INTRO_PARAGRAPHS.join(' ')),'The introduction leaves the explanation to room discoveries.');
 assert(storyIntroDurationMs()>=40000&&storyIntroDurationMs()<=60000);
 assert.equal(storyIntroDurationMs(['One word.']),40000);assert.equal(storyIntroDurationMs(['word '.repeat(500)]),60000);
});

test('scrolling time advances continuously, pauses exactly, and finishes once',()=>{
 const intro=createStoryIntroClock({duration:1000}),initial=intro.state;assert(Object.isFrozen(initial));assert.equal(initial.progress,0);
 intro.update(16);assert.equal(intro.state.elapsed,16);assert.equal(intro.state.progress,.016);assert.equal(initial.elapsed,0);
 assert(intro.pause());const paused=intro.state;assert.equal(intro.update(100),false);assert.equal(intro.state,paused);assert.equal(intro.pause(),false);
 assert(intro.play());assert.equal(intro.play(),false);intro.update(16);assert.equal(intro.state.elapsed,32);
 while(!intro.state.finished)intro.update(16);
 assert.deepEqual(intro.state,{elapsed:1000,duration:1000,progress:1,playing:false,finished:true,skipped:false});
 assert.equal(intro.update(16),false);assert.equal(intro.finish(),false);assert.equal(intro.skip(),false);assert.equal(intro.play(),false);
});

test('skip works before the first frame or during reading without a second completion',()=>{
 for(const elapsed of [0,16,500]){
  const intro=createStoryIntroClock({duration:1000});for(let time=0;time<elapsed;time+=16)intro.update(Math.min(16,elapsed-time));
  intro.pause();assert(intro.skip());assert.equal(intro.state.finished,true);assert.equal(intro.state.skipped,true);assert.equal(intro.state.progress,1);
  const done=intro.state;assert.equal(intro.finish(),false);assert.equal(intro.skip(),false);assert.equal(intro.state,done);
 }
});

test('invalid or stalled time cannot warp the crawl or corrupt its progress',()=>{
 const intro=createStoryIntroClock({duration:1000}),initial=intro.state;
 for(const delta of [0,-1,NaN,Infinity,'16'])assert.equal(intro.update(delta),false);
 assert.equal(intro.state,initial);intro.update(60000);assert.equal(intro.state.elapsed,100,'A stalled frame advances only one bounded step.');
 for(const duration of [0,-1,NaN,Infinity,'1000'])assert.throws(()=>createStoryIntroClock({duration}),TypeError);
});
