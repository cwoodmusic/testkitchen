const test=require('node:test'),assert=require('node:assert/strict');
const trivia=require('../musician-trivia.js'),notes=require('../notes-shop.js');
function storage(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};}
function fixture(options={}){const saved=options.storage||storage(),wallet=notes.createWallet({storage:saved});let near=true;const rewards=[];const quiz=trivia.createSession({wallet,canTalkTo:()=>near,onReward:value=>rewards.push(value),...options});return {saved,wallet,quiz,rewards,setNear:value=>near=value};}
test('45 authored questions have valid unique IDs, varied answers, and five per musician',()=>{
 assert.equal(trivia.QUESTIONS.length,45);assert.equal(new Set(trivia.QUESTIONS.map(q=>q.id)).size,45);
 for(const [id,topic]of Object.entries(trivia.PERSON_TOPICS)){assert.equal(trivia.QUESTIONS.filter(q=>q.person===id).length,5);assert.ok(topic);}
 for(const q of trivia.QUESTIONS){assert.match(q.id,/^[a-z0-9-]+$/);assert.equal(q.choices.length,3);assert.equal(new Set(q.choices).size,3);assert.ok(q.answer>=0&&q.answer<3);assert.equal(q.reward,4);assert.ok(q.hint.length>12);assert.ok(q.explanation.length>20);}
 assert.equal(new Set(trivia.QUESTIONS.map(q=>q.answer)).size,3);
 const text=trivia.QUESTIONS.map(q=>q.prompt+' '+q.explanation).join(' ');
 for(const concept of ['steady beat','rhythm','pitch','dynamics','timbre','tempo','fortepiano'])assert.match(text.toLowerCase(),new RegExp(concept));
});
test('music questions require a real nearby musician at launch and at answer time',()=>{
 const {quiz,wallet,setNear}=fixture();setNear(false);assert.equal(quiz.open('miles').ok,false);assert.equal(wallet.snapshot().balance,150);
 setNear(true);assert.equal(quiz.open('miles').ok,true);const answer=quiz.getState().question.answer;setNear(false);assert.equal(quiz.answer(answer).ok,false);assert.equal(wallet.snapshot().balance,150);
 for(const id of ['missing','__proto__','constructor',null])assert.equal(quiz.open(id).ok,false);
 assert.equal(trivia.createSession({wallet}).open('bach').ok,false,'Missing proximity check fails closed');
});
test('a wrong answer gives a hint, and a correct retry awards four Notes once',()=>{
 const {quiz,wallet,rewards}=fixture();quiz.open({id:'joplin',name:'Scott Joplin'});const q=quiz.getState().question;
 assert.equal(quiz.next().ok,false);assert.equal(quiz.answer((q.answer+1)%3).correct,false);assert.equal(wallet.snapshot().balance,150);assert.match(quiz.getState().message,/Not quite/);
 const correct=quiz.answer(q.answer);assert.equal(correct.amount,4);assert.equal(wallet.snapshot().balance,154);assert.deepEqual(wallet.snapshot().rewards,[trivia.PREFIX+q.id]);assert.equal(rewards.length,1);
 assert.equal(quiz.getState().status,'correct');assert.match(quiz.getState().message,/Correct/);assert.equal(quiz.answer(q.answer).amount,0);assert.equal(wallet.snapshot().balance,154);assert.equal(rewards.length,1);
 assert.equal(quiz.next().ok,true);assert.notEqual(quiz.getState().question.id,q.id);
});
test('all musician rewards persist after reload, and completed questions remain free practice',()=>{
 const {quiz,wallet,saved}=fixture();quiz.open('bach');
 for(let at=0;at<5;at++){quiz.answer(quiz.getState().question.answer);if(at<4)quiz.next();}
 assert.equal(wallet.snapshot().balance,170);assert.equal(quiz.getState().earned,5);assert.equal(quiz.getState().globalEarned,5);
 const restored=notes.createWallet({storage:saved}),review=trivia.createSession({wallet:restored,canTalkTo:()=>true});review.open('bach');assert.equal(review.getState().practice,true);
 for(let at=0;at<6;at++){assert.equal(review.answer(review.getState().question.answer).amount,0);review.next();}assert.equal(restored.snapshot().balance,170);
 review.open('miles');assert.equal(review.getState().earned,0);assert.equal(review.answer(review.getState().question.answer).amount,4);assert.equal(restored.snapshot().balance,174);
});
test('two open question sessions and separate wallet instances cannot double-pay the same answer',()=>{
 const saved=storage(),a=fixture({storage:saved}),b=fixture({storage:saved});a.quiz.open('mozart');b.quiz.open('mozart');const q=a.quiz.getState().question;
 assert.equal(a.quiz.answer(q.answer).amount,4);assert.equal(b.quiz.answer(q.answer).amount,0);assert.equal(b.wallet.snapshot().balance,154);assert.equal(b.rewards.length,0);
});
test('failed wallet saving keeps the correct answer retryable and never pretends to pay',()=>{
 const saved=storage();let blocked=false;const original=saved.setItem;saved.setItem=(key,value)=>{if(blocked)throw Error('quota');original(key,value);};const {quiz,wallet}=fixture({storage:saved});quiz.open('beethoven');const q=quiz.getState().question;
 blocked=true;assert.equal(quiz.answer(q.answer).ok,false);assert.equal(quiz.getState().status,'error');assert.equal(wallet.snapshot().balance,150);assert.equal(quiz.next().ok,false);
 blocked=false;assert.equal(quiz.answer(q.answer).amount,4);assert.equal(wallet.snapshot().balance,154);assert.equal(quiz.answer(q.answer).amount,0);
});
test('a saved wallet credit followed by an interrupted response remains exactly once on retry',()=>{
 const {wallet}=fixture();let interrupt=true;const proxy={snapshot:wallet.snapshot,refresh:wallet.refresh,grantReward:(id,amount)=>{const result=wallet.grantReward(id,amount);if(interrupt){interrupt=false;throw Error('response interrupted');}return result;}};
 const quiz=trivia.createSession({wallet:proxy,canTalkTo:()=>true});quiz.open('clara');const q=quiz.getState().question;assert.equal(quiz.answer(q.answer).ok,false);assert.equal(wallet.snapshot().balance,154);
 assert.equal(quiz.answer(q.answer).alreadyClaimed,true);assert.equal(wallet.snapshot().balance,154);assert.equal(wallet.snapshot().rewards.length,1);
});
test('invalid answers and missing wallets grant nothing, while UI callback failures cannot undo a saved reward',()=>{
 const {quiz,wallet}=fixture();quiz.open('nina');for(const answer of [-1,3,NaN,'0',null])assert.equal(quiz.answer(answer).ok,false);assert.equal(wallet.snapshot().balance,150);
 const missing=trivia.createSession({canTalkTo:()=>true});missing.open('ella');assert.equal(missing.answer(missing.getState().question.answer).ok,false);
 const working=trivia.createSession({wallet,canTalkTo:()=>true,onReward(){throw Error('UI');}});working.open('nina');assert.equal(working.answer(working.getState().question.answer).amount,4);assert.equal(wallet.snapshot().balance,154);
});
