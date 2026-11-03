/* Chopin's timed pitch-reading game. Pitch generation and timing are independent of rendering. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaPianoSightReading=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const NAT=[0,2,4,5,7,9,11],LETTERS='CDEFGAB',SHARPS='FCGDAEB',FLATS='BEADGCF';
 const LEVELS=Object.freeze([
  {id:'naturals',name:'Natural notes',count:1,accidentals:false,keys:0,naturals:false},
  {id:'accidentals',name:'Sharps and flats',count:1,accidentals:true,keys:0,naturals:false},
  {id:'keys',name:'Key signatures',count:1,accidentals:true,keys:2,naturals:false},
  {id:'cancellations',name:'Natural signs and keys',count:1,accidentals:true,keys:4,naturals:true},
  {id:'pairs',name:'Two pitches',count:2,accidentals:true,keys:4,naturals:true},
  {id:'triples',name:'Three pitches',count:3,accidentals:true,keys:4,naturals:true}
 ].map(Object.freeze));
 const levelFor=score=>LEVELS[Math.min(LEVELS.length-1,Math.floor(score/10))];
 function create(options={}){
  const random=options.random||Math.random,clef=options.clef==='bass'?'bass':'treble',baseMidi=60;
  const playable=new Set((options.playableMidis||Array.from({length:24},(_,i)=>60+i)).filter(midi=>Number.isInteger(midi)&&midi>=60&&midi<=83));
  let remaining=10,score=0,turns=0,mistakes=0,ended=false,turn;
  const pick=n=>Math.min(n-1,Math.max(0,Math.floor(random()*n)));
  function next(){
   const level=levelFor(score),key=level.keys?(turns%2?1:-1)*(1+pick(level.keys)):0,keyLetters=(key<0?FLATS:SHARPS).slice(0,Math.abs(key)),notes=[],alterations=new Map();
   for(let i=0;i<level.count;i++){
    // Filter sounding pitches after applying signatures and explicit accidentals.
    // The floor's actual key list is authoritative, including its two endpoints.
    const candidates=[];
    for(let degree=1;degree<=(clef==='bass'?7:12);degree++){
     const letter=LETTERS[degree%7],natural=baseMidi+12*Math.floor(degree/7)+NAT[degree%7],signature=keyLetters.includes(letter)?Math.sign(key):0;
     const wantsExplicit=level.accidentals&&(!level.keys||(turns+i)%3===0),explicit=wantsExplicit&&(!signature||level.naturals),alter=explicit?(signature?0:(turns+i)%2?1:-1):signature;
     if(playable.has(natural+alter))candidates.push({degree,letter,natural,signature,explicit,alter});
    }
    if(!candidates.length)throw Error('No playable Note Dash pitches for this keyboard.');
    const cancellations=level.naturals&&(turns+i)%3===0?candidates.filter(note=>note.signature&&note.explicit&&note.alter===0):[],pool=cancellations.length?cancellations:candidates;
    const {degree,letter,natural,signature,explicit,alter}=pool[pick(pool.length)];
    const diatonic=(baseMidi/12-1)*7+degree,previous=alterations.has(diatonic)?alterations.get(diatonic):signature;
    notes.push({midi:natural+alter,letter,diatonic,accidental:explicit||alter!==previous?(alter===0?'natural':alter>0?'sharp':'flat'):null,alter,done:false});alterations.set(diatonic,alter);
   }
   turn={key,keyLetters,notes,index:0,stage:level.id};
  }
  next();
  function tick(seconds){if(!ended&&Number.isFinite(seconds)&&seconds>0){remaining=Math.max(0,remaining-seconds);if(remaining===0)ended=true;}return snapshot();}
  function answer(midi){
   if(ended)return {ok:false,ended:true};
   if(midi!==turn.notes[turn.index].midi){mistakes++;remaining=Math.max(0,remaining-1);if(remaining===0)ended=true;return {ok:false,penalty:1,ended};}
   turn.notes[turn.index].done=true;turn.index++;score++;remaining+=3;
   const complete=turn.index===turn.notes.length;if(complete){turns++;next();}
   return {ok:true,complete,bonus:3};
  }
  function snapshot(){return {clef,difficulty:levelFor(score).id,stage:Math.min(6,Math.floor(score/10)+1),stageName:levelFor(score).name,baseMidi,remaining,score,turns,mistakes,ended,turn:JSON.parse(JSON.stringify(turn))};}
  return {tick,answer,snapshot};
 }
 function draw(ctx,options){
  const s=options.score.reading,{x=0,y=0,width=428,height=120}=options;
  ctx.save();ctx.translate(x,y);ctx.scale(width/428,height/120);ctx.fillStyle='#102938';ctx.fillRect(0,0,428,120);ctx.strokeStyle='#86ecd9';ctx.strokeRect(1,1,426,118);
  ctx.fillStyle=s.remaining<=3?'#ffb9aa':'#fff2a2';ctx.font='bold 13px system-ui';ctx.textAlign='left';ctx.fillText('Note Rush · '+s.stageName,10,18);ctx.textAlign='right';ctx.fillText(s.remaining.toFixed(1)+'s · '+s.score+' correct',416,18);
  const base=s.clef==='bass'?18:30,highest=Math.max(8,...s.turn.notes.map(note=>note.diatonic-base)),space=Math.min(9,112/(highest+4)),baseline=highest>10?96:84,glyph=name=>({treble:'\ue050',bass:'\ue062',sharp:'\ue262',flat:'\ue260',natural:'\ue261',note:'\ue0a4'})[name];
  ctx.strokeStyle='#86a5b8';ctx.beginPath();for(let i=0;i<5;i++){ctx.moveTo(12,baseline-i*space);ctx.lineTo(416,baseline-i*space);}ctx.stroke();ctx.textAlign='left';ctx.font=(space*4)+'px CodaBravura';ctx.fillStyle='#e7f6ff';ctx.fillText(glyph(s.clef),17,baseline-(s.clef==='bass'?3:1)*space);
  const keyPositions=s.clef==='bass'?(s.turn.key>0?[6,3,7,4]:[2,5,1,4]):s.turn.key>0?[8,5,9,6]:[4,7,3,6];
  for(let i=0;i<Math.abs(s.turn.key);i++)ctx.fillText(glyph(s.turn.key>0?'sharp':'flat'),58+i*11,baseline-keyPositions[i]*space/2);
  const left=120;
  for(const [i,note]of s.turn.notes.entries()){
   const position=note.diatonic-base,xx=left+i*90,yy=baseline-position*space/2;
   if(i===s.turn.index){ctx.fillStyle='#fff2a2';ctx.beginPath();ctx.moveTo(xx-4,27);ctx.lineTo(xx+4,27);ctx.lineTo(xx,33);ctx.closePath();ctx.fill();}
   ctx.fillStyle=note.done?'#9ae8b4':i===s.turn.index?'#fff2a2':'#dce8f7';ctx.strokeStyle=ctx.fillStyle;ctx.beginPath();
   for(let line=-2;line>=position;line-=2){ctx.moveTo(xx-11,baseline-line*space/2);ctx.lineTo(xx+11,baseline-line*space/2);}
   for(let line=10;line<=position;line+=2){ctx.moveTo(xx-11,baseline-line*space/2);ctx.lineTo(xx+11,baseline-line*space/2);}
   ctx.stroke();ctx.font=(space*4)+'px CodaBravura';ctx.fillText(glyph('note'),xx-6,yy);if(note.accidental)ctx.fillText(glyph(note.accidental),xx-26,yy);
   ctx.beginPath();const down=position>=4;ctx.moveTo(xx+(down?-6:6),yy);ctx.lineTo(xx+(down?-6:6),yy+(down?space*2.7:-space*2.7));ctx.stroke();
  }
  ctx.fillStyle='#c7dce7';ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillText('Read left to right · stand on a key + E · +3s per correct pitch',10,113);ctx.restore();
 }
 return Object.freeze({LEVELS,create,draw});
});
