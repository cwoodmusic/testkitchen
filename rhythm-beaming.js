/* One-line rhythm engraving. Beat groups use written time, never viewport edges. */
(function(root,factory){const notation=typeof module==='object'&&module.exports?require('./music-notation.js'):root?.CodaMusicNotation;const api=factory(notation);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaRhythmBeaming=api;})(typeof window==='undefined'?null:window,function(notation){
 'use strict';
 const EPSILON=1e-7;
 const METERS=Object.freeze({'4/4':{pulseBeats:1,barBeats:4},'6/8':{pulseBeats:1.5,barBeats:3},'2/2':{pulseBeats:2,barBeats:4}});
 const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
 function meterInfo(options={}){
  const id=options.meter==='cut'||options.meter==='cut-time'?'2/2':options.meter||options.meterInfo?.id||'4/4',base=METERS[id]||METERS['4/4'];
  return {id:Object.hasOwn(METERS,id)?id:'4/4',pulseBeats:finite(options.pulseBeats,finite(options.meterInfo?.pulseBeats,base.pulseBeats)),barBeats:finite(options.barBeats,finite(options.meterInfo?.barBeats,base.barBeats))};
 }
 function levels(note){
  if(!note||note.rest||!Number.isFinite(note.duration)||note.duration<=0)return 0;
  if(Math.abs(note.duration-.25)<EPSILON||Math.abs(note.duration-.375)<EPSILON)return 2;
  if(Math.abs(note.duration-.5)<EPSILON||Math.abs(note.duration-.75)<EPSILON)return 1;
  return 0;
 }
 function secondaryBeams(members){
  const spans=[];
  for(let at=0;at<members.length;){
   if(members[at].levels!==2){at++;continue;}
   let end=at;while(end+1<members.length&&members[end+1].levels===2)end++;
   if(end>at){for(let index=at;index<end;index++)spans.push({from:index,to:index+1,hook:false});}
   else{
    // A single sixteenth gets a short secondary beam. Prefer the other half
    // of its eighth-note unit; at the ends, point inward toward the group.
    const sixteenth=Math.round(members[at].onset/.25),direction=at===0?1:at===members.length-1?-1:sixteenth%2===0?1:-1;
    spans.push({from:at,to:at+direction,hook:true,direction});
   }
   at=end+1;
  }
  return spans;
 }
 function plan(notes,options={}){
  const meter=meterInfo(options),groups=[],singles=[],ordered=[];let pending=[];
  if(!(meter.pulseBeats>0&&meter.barBeats>0))return {meter,groups,singles};
  (Array.isArray(notes)?notes:[]).forEach((note,index)=>{
   const onset=finite(note?.onset,finite(note?.beat,NaN));
   if(note&&Number.isFinite(onset)&&Number.isFinite(note.duration)&&note.duration>0)ordered.push({note,index,onset,levels:levels(note)});
  });
  ordered.sort((a,b)=>a.onset-b.onset||a.index-b.index);
  const flush=()=>{
   if(pending.length>1){const first=pending[0];groups.push({id:'beam-'+first.bar+'-'+first.pulse+'-'+String(first.note.id??first.index),bar:first.bar,pulse:first.pulse,members:pending,secondary:secondaryBeams(pending)});}
   else if(pending.length)singles.push(pending[0]);pending=[];
  };
  for(const item of ordered){
   const bar=Math.floor((item.onset+EPSILON)/meter.barBeats),local=item.onset-bar*meter.barBeats,pulse=Math.floor((local+EPSILON)/meter.pulseBeats),end=bar*meter.barBeats+Math.min(meter.barBeats,(pulse+1)*meter.pulseBeats);
   item.bar=bar;item.pulse=pulse;
   if(!item.levels||item.onset+item.note.duration>end+EPSILON){flush();singles.push(item);continue;}
   const last=pending[pending.length-1];
   if(last&&(last.bar!==bar||last.pulse!==pulse||Math.abs(last.onset+last.note.duration-item.onset)>EPSILON))flush();
   pending.push(item);
  }
  flush();singles.sort((a,b)=>a.index-b.index);
  return {meter,groups,singles};
 }
 const defaultColor=note=>note.judgement==='hit'?'#8ff3bf':note.judgement==='miss'?'#ec879b':note.rest?'#a4b8cb':'#f8ead2';
 function draw(ctx,options={}){
  const result=plan(options.notes,options);if(!ctx||!notation?.drawRhythm)return {...result,drawnGroups:0,drawnNotes:0};
  const size=Math.max(12,finite(options.fontSize,56)),y=finite(options.y,100),left=finite(options.left,-Infinity),right=finite(options.right,Infinity),xFor=typeof options.xForNote==='function'?options.xForNote:note=>finite(note.x,NaN),colour=typeof options.colorForNote==='function'?options.colorForNote:defaultColor;
  const headOrigin=.166*size,stemCenter=.151*size,stemHalf=.015*size,top=y-.875*size,thickness=Math.max(2,size*.085),secondY=top+size*.14;
  let drawnGroups=0,drawnNotes=0;
  const visible=x=>Number.isFinite(x)&&x>=left-size*.6&&x<=right+size*.6;
  function ink(note){return colour(note)||'#f8ead2';}
  function span(x1,x2,beamY,color){if(!(Number.isFinite(x1)&&Number.isFinite(x2)))return;ctx.fillStyle=color;ctx.fillRect(Math.min(x1,x2),beamY,Math.max(1,Math.abs(x2-x1)),thickness);}
  function connected(a,b,beamY){const first=ink(a.member.note),second=ink(b.member.note);if(first===second){span(a.x,b.x,beamY,first);return;}const mid=(a.x+b.x)/2;span(a.x,mid,beamY,first);span(mid,b.x,beamY,second);}
  ctx.save();
  if(Number.isFinite(left)&&Number.isFinite(right)&&right>left){ctx.beginPath();ctx.rect(left,finite(options.top,0),right-left,finite(options.height,ctx.canvas?.height||4000));ctx.clip();}
  for(const item of result.singles){const x=xFor(item.note,item.index);if(!visible(x))continue;notation.drawRhythm(ctx,{x,y,beats:item.note.notationBeats??item.note.duration,rest:item.note.rest,fontSize:size,color:ink(item.note),stem:'up'});drawnNotes++;}
  for(const group of result.groups){
   const positions=group.members.map(member=>({member,x:xFor(member.note,member.index)+stemCenter}));
   if(positions.some(point=>!Number.isFinite(point.x)))continue;
   if(positions[positions.length-1].x+size*.5<left||positions[0].x-size*.5>right)continue;
   drawnGroups++;
   for(const point of positions){
    const member=point.member,note=member.note,x=point.x-stemCenter;if(!visible(x))continue;
    // This font's complete quarter-note has exactly the head and unflagged
    // upward stem we need. Its stem top is .875em above the musical baseline.
    notation.drawRhythm(ctx,{x,y,beats:1,fontSize:size,color:ink(note),stem:'up'});drawnNotes++;
    const item=notation.symbol(note.duration);if(item.dots){ctx.save();ctx.font=size+'px "'+notation.FAMILY+'"';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle=ink(note);ctx.fillText(notation.glyph('augmentationDot'),x+size*.27,y-size*.125);ctx.restore();}
   }
   const first=positions[0],last=positions[positions.length-1];
   span(first.x-stemHalf,first.x,top,ink(first.member.note));
   for(let at=0;at<positions.length-1;at++)connected(positions[at],positions[at+1],top);
   span(last.x,last.x+stemHalf,top,ink(last.member.note));
   for(const beam of group.secondary){
    const start=positions[beam.from],end=positions[beam.to];
    if(beam.hook){const length=Math.min(size*.30,Math.abs(end.x-start.x)*.46);span(start.x-stemHalf,start.x+beam.direction*length,secondY,ink(start.member.note));}
    else connected(start,end,secondY);
   }
  }
  ctx.restore();
  return {...result,drawnGroups,drawnNotes,metrics:{fontSize:size,beamTop:top,secondaryTop:secondY,beamThickness:thickness,stemCenter,headOrigin}};
 }
 return {METERS,levels,meterInfo,plan,draw};
});
