/* Bravura scores for Piano Lab. Written rhythm is a reading aid, never a timer. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaPianoWallNotation=api;})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const LETTERS=['C','D','E','F','G','A','B'],NATURALS={C:0,D:2,E:4,F:5,G:7,A:9,B:11},DEFAULTS=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
 const CODES={gClef:0xe050,fClef:0xe062,noteheadBlack:0xe0a4,noteWhole:0xe1d2,noteHalfUp:0xe1d3,noteHalfDown:0xe1d4,noteQuarterUp:0xe1d5,noteQuarterDown:0xe1d6,note8thUp:0xe1d7,note8thDown:0xe1d8,note16thUp:0xe1d9,note16thDown:0xe1da,augmentationDot:0xe1e7,restWhole:0xe4e3,restHalf:0xe4e4,restQuarter:0xe4e5,rest8th:0xe4e6,rest16th:0xe4e7,sharp:0xe262,flat:0xe260,natural:0xe261};
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n)),finite=(n,fallback)=>Number.isFinite(n)?n:fallback;
 function pitch(midi,spelling){
  const fallback=DEFAULTS[((midi%12)+12)%12],match=typeof spelling==='string'?/^([A-G])([♭b♯#]?)$/.exec(spelling):null;
  const name=match?match[1]+(match[2]==='b'?'♭':match[2]==='#'?'♯':match[2]):fallback,letter=name[0],delta=name.includes('♯')?1:name.includes('♭')?-1:0,octave=Math.round((midi-12-NATURALS[letter]-delta)/12);
  if(12*(octave+1)+NATURALS[letter]+delta!==midi)return pitch(midi);
  return {midi,label:name,letter,diatonic:octave*7+LETTERS.indexOf(letter),accidental:delta===1?'sharp':delta===-1?'flat':null};
 }
 function ledgerLines(position){const lines=[];if(position<0)for(let at=-2;at>=position;at-=2)lines.push(at);if(position>8)for(let at=10;at<=position;at+=2)lines.push(at);return lines;}
 function rhythm(beats,rest=false,down=false){
  const plain=[4,2,1,.5,.25],base=plain.find(value=>Math.abs(value-beats)<1e-8)||plain.find(value=>Math.abs(value*1.5-beats)<1e-8)||1,dots=Math.abs(base*1.5-beats)<1e-8?1:0,type=base===4?'Whole':base===2?'Half':base===1?'Quarter':base===.5?'8th':'16th';
  return {baseBeats:base,dots,flags:rest||base>=1?0:base===.25?2:1,glyph:rest?'rest'+type:base===4?'noteWhole':'note'+type+(down?'Down':'Up')};
 }
 function sourceEvents(options){
  let onset=0,noteIndex=0;const explicit=Array.isArray(options.events),source=explicit?options.events:(Array.isArray(options.notes)?options.notes:[]).map((midi,index)=>({midi,beats:1,spelling:options.spellings?.[index]})),out=[];
  for(const item of source){const value=typeof item==='number'?{midi:item,beats:1}:item;if(!value||(!value.rest&&(!Number.isInteger(value.midi)||value.midi<0||value.midi>127)))continue;const beats=finite(value.beats,1);if(beats<=0||beats>6)continue;const rest=value.rest===true||value.midi===null,event={...value,midi:rest?null:value.midi,rest,beats,onset,index:out.length,noteIndex:rest?null:noteIndex++};out.push(event);onset+=beats;}
  return out;
 }
 function createScore(options={}){
  const memory=options.mode==='memory',meter=options.meter==='6/8'?'6/8':'4/4',barBeats=meter==='6/8'?3:4,pulseBeats=meter==='6/8'?1.5:1;
  const events=sourceEvents(options),total=events.filter(event=>!event.rest).length,step=clamp(Math.floor(finite(options.step,0)),0,total),lastPlayed=memory?events.find(event=>event.noteIndex===step-1):null,allowed=memory?events.filter(event=>event.rest?lastPlayed&&event.onset<lastPlayed.onset:event.noteIndex<step):events;
  const current=events.find(event=>event.noteIndex===Math.min(step,Math.max(0,total-1))),lastAllowed=allowed.at(-1),page=memory?Math.floor((lastAllowed?.onset||0)/barBeats):Math.floor((current?.onset||0)/barBeats),startBeat=page*barBeats,endBeat=startBeat+barBeats;
  const visible=allowed.filter(event=>event.onset>=startBeat-1e-8&&event.onset<endBeat-1e-8),pitches=visible.filter(event=>!event.rest).map(event=>pitch(event.midi,event.spelling)),sorted=pitches.map(note=>note.midi).sort((a,b)=>a-b),clef=sorted.length&&sorted[Math.floor(sorted.length/2)]<60?'bass':'treble',base=clef==='bass'?18:30,accidentals=new Map();
  const prepared=visible.map(event=>{
   const note=event.rest?{label:'Rest',position:4,ledgerLines:[],accidental:null}:{...pitch(event.midi,event.spelling)},position=event.rest?4:note.diatonic-base;
   if(!event.rest){const previous=accidentals.get(note.diatonic);note.accidental=note.accidental||(previous?'natural':null);accidentals.set(note.diatonic,pitch(event.midi,event.spelling).accidental);}
   const symbol=rhythm(event.beats,event.rest,position>=4),status=event.rest?(event.onset<(current?.onset??Infinity)||step>=total?'done':'rest'):event.noteIndex<step?'done':event.noteIndex===step?'current':'upcoming';
   return {...event,...note,...symbol,position,ledgerLines:event.rest?[]:ledgerLines(position),bar:page,beat:event.onset-startBeat,status,beamGroup:!event.rest&&symbol.flags?'beam-'+page+'-'+Math.floor((event.onset-startBeat+1e-8)/pulseBeats):null};
  });
  // Rests break beams; compound meter groups eighths in two groups of three.
  let run=[];function closeRun(){if(run.length>1){const id=run[0].beamGroup+'-'+run[0].index;for(const event of run){event.beamGroup=id;event.beamed=true;}}else for(const event of run)event.beamGroup=null;run=[];}
  for(const event of prepared){if(!event.beamGroup){closeRun();continue;}if(run.length&&(run[0].beamGroup!==event.beamGroup||Math.abs(run.at(-1).onset+run.at(-1).beats-event.onset)>1e-8))closeRun();run.push(event);}closeRun();
  return {mode:memory?'memory':options.mode||'melody',label:memory?'From memory':typeof options.label==='string'?options.label.slice(0,90):'Play these notes',meter,barBeats,pulseBeats,clef,events:prepared,notes:prepared.filter(event=>!event.rest),step,total,page,bar:page,startBeat,endBeat,complete:step>=total&&total>0,answerHidden:memory,barLines:[startBeat,endBeat]};
 }
 function draw(ctx,options={}){
  if(!ctx||!options.score)return null;const score=options.score,x=finite(options.x,286),y=finite(options.y,72),width=Math.max(120,finite(options.width,428)),height=Math.max(80,finite(options.height,120)),notation=root?.CodaMusicNotation,family=notation?.FAMILY||'CodaBravura',symbol=name=>notation?.glyph?.(name)||String.fromCodePoint(CODES[name]);
  ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();ctx.fillStyle='#102938';ctx.fillRect(x,y,width,height);ctx.strokeStyle='#86ecd9';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,width-2,height-2);ctx.translate(x,y);ctx.textAlign='left';ctx.textBaseline='alphabetic';
  const scale=Math.min(1,width/428,height/120);ctx.font='bold '+Math.max(10,12*scale)+'px system-ui';ctx.fillStyle='#e9ffe8';const title=score.label||'Play these notes',maxTitle=Math.max(12,Math.floor(width/(7*scale)));ctx.fillText(title.length>maxTitle?title.slice(0,maxTitle-1)+'…':title,10,height*.16);
  const topLimit=height*.31,bottomLimit=height*.78,positions=score.notes.map(note=>note.position),topExtent=Math.max(8,...positions.map(position=>position+(position<4?7:1))),bottomExtent=Math.min(0,...positions.map(position=>position-(position>=4?7:1))),space=Math.min(9*scale,(bottomLimit-topLimit)*2/Math.max(8,topExtent-bottomExtent)),baseline=topLimit+topExtent*space/2,fontSize=4*space;
  ctx.strokeStyle='#83a2b2';ctx.lineWidth=Math.max(.7,scale);ctx.beginPath();for(let line=0;line<5;line++){const yy=baseline-line*space;ctx.moveTo(12,yy);ctx.lineTo(width-12,yy);}ctx.stroke();ctx.font=fontSize+'px "'+family+'"';ctx.fillStyle='#e7f6ff';ctx.fillText(symbol(score.clef==='bass'?'fClef':'gClef'),15,baseline-(score.clef==='bass'?3:1)*space);
  const parts=score.meter==='6/8'?[6,8]:[4,4],timeX=52*scale;ctx.textAlign='center';ctx.fillText(String.fromCodePoint(0xe080+parts[0]),timeX,baseline-3.15*space);ctx.fillText(String.fromCodePoint(0xe080+parts[1]),timeX,baseline-.85*space);ctx.textAlign='left';
  const left=Math.max(69*scale,50),right=width-16*scale,usable=right-left,pad=.24,positionX=event=>left+(event.beat+pad)/(score.barBeats+pad*2)*usable,points=[],groups=new Map();
  ctx.strokeStyle='#a4bec7';ctx.lineWidth=1.2;ctx.beginPath();for(const xx of [left-3,right]){ctx.moveTo(xx,baseline-4*space);ctx.lineTo(xx,baseline);}ctx.stroke();
  for(const event of score.events||score.notes){
   const xx=positionX(event),yy=event.rest?baseline-(event.baseBeats===4?3:2)*space:baseline-event.position*space/2,color=event.status==='done'?'#9ae8b4':event.status==='current'?'#fff2a2':'#dce8f7';
   if(event.status==='current'){ctx.save();ctx.globalAlpha=options.reducedMotion?1:.8+Math.sin(finite(options.time,0)*4)*.2;ctx.fillStyle='#206d78';ctx.beginPath();ctx.arc(xx,yy,space*.95,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f9df7d';ctx.lineWidth=1.6;ctx.stroke();ctx.restore();}
   ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,scale);ctx.beginPath();for(const line of event.ledgerLines||[]){const ly=baseline-line*space/2;ctx.moveTo(xx-space,ly);ctx.lineTo(xx+space,ly);}ctx.stroke();ctx.font=fontSize+'px "'+family+'"';ctx.fillStyle=color;
   const origin=event.rest?({restWhole:.1415,restHalf:.1415,restQuarter:.1355,rest8th:.125,rest16th:.16}[event.glyph]||.15):event.baseBeats===4?.2295:event.baseBeats===2?.1705:.166;
   ctx.fillText(symbol(event.beamed?'noteheadBlack':event.glyph),xx-(event.beamed?.166:origin)*fontSize,yy);
   if(event.accidental)ctx.fillText(symbol(event.accidental),xx-space*2.0,yy);
   for(let dot=0;dot<event.dots;dot++)ctx.fillText(symbol('augmentationDot'),xx+space*(1.15+dot*.6),yy-(event.position%2===0?space*.5:0));
   if(event.beamed){if(!groups.has(event.beamGroup))groups.set(event.beamGroup,[]);groups.get(event.beamGroup).push({event,x:xx,y:yy,color});}
   if(options.showNames===true&&!event.rest){ctx.font='bold '+Math.max(9,10*scale)+'px system-ui';ctx.textAlign='center';ctx.fillText(event.label,xx,height-16*scale);ctx.textAlign='left';}
   points.push({index:event.index,noteIndex:event.noteIndex,midi:event.midi,rest:event.rest,beats:event.beats,x:x+xx,y:y+yy,status:event.status,glyph:event.glyph,beamed:!!event.beamed});
  }
  for(const group of groups.values()){
   const down=group.reduce((sum,item)=>sum+item.event.position,0)/group.length>=4,beamY=down?Math.max(...group.map(item=>item.y))+3.1*space:Math.min(...group.map(item=>item.y))-3.1*space,stemX=item=>item.x+(down?-.62:.62)*space,thickness=Math.max(1.6,space*.4);
   ctx.strokeStyle='#dce8f7';ctx.lineWidth=Math.max(1,space*.12);ctx.beginPath();for(const item of group){ctx.moveTo(stemX(item),item.y);ctx.lineTo(stemX(item),beamY);}ctx.stroke();ctx.fillStyle='#dce8f7';ctx.fillRect(stemX(group[0]),beamY,stemX(group.at(-1))-stemX(group[0]),thickness);
   for(let at=0;at<group.length;at++)if(group[at].event.flags>=2){const next=group[at+1],prior=group[at-1],offset=(down?-1:1)*space*.75,xx=stemX(group[at]);if(next?.event.flags>=2)ctx.fillRect(xx,beamY+offset,stemX(next)-xx,thickness);else if(prior?.event.flags<2||!prior){const hook=(next?1:-1)*Math.max(space,(next?stemX(next)-xx:xx-stemX(prior))*.35);ctx.fillRect(Math.min(xx,xx+hook),beamY+offset,Math.abs(hook),thickness);}}
  }
  if(!score.notes.length){ctx.font='bold '+Math.max(10,12*scale)+'px system-ui';ctx.fillStyle='#b5dfdf';ctx.textAlign='center';ctx.fillText(score.answerHidden?'Play the melody from memory':'Listen through the written rest',width*.58,height*.54);ctx.textAlign='left';}
  ctx.font=Math.max(9,10*scale)+'px system-ui';ctx.fillStyle='#c7dce7';ctx.fillText(score.answerHidden?'Your played pitches':'Play the next pitch • no timing needed',10,height-5*scale);ctx.textAlign='right';ctx.fillText(score.step+' / '+score.total,width-10,height-5*scale);ctx.restore();return {x,y,width,height,clef:score.clef,meter:score.meter,bar:score.bar,notes:points,barLines:[left-3,right].map(xx=>x+xx)};
 }
 return Object.freeze({createScore,draw,pitch,ledgerLines,rhythm});
});
