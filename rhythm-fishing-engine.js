/* Rhythm fishing rules and notation data. The room supplies a paused-aware clock. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaRhythmFishing=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const copy=value=>JSON.parse(JSON.stringify(value));
 const TARGET_BARS=8,PERFECT_TARGET_BARS=4,START_PROGRESS=45,CLEAN_BAR_GAIN=(100-START_PROGRESS)/TARGET_BARS,MAX_SIXTEENTH_BPM=100;
 const METERS=Object.freeze({
  '4/4':Object.freeze({id:'4/4',timeSignature:'4/4',label:'4/4',numerator:4,denominator:4,barBeats:4,pulseBeats:1,pulsesPerBar:4,pulseUnit:'quarter'}),
  '6/8':Object.freeze({id:'6/8',timeSignature:'6/8',label:'6/8',numerator:6,denominator:8,barBeats:3,pulseBeats:1.5,pulsesPerBar:2,pulseUnit:'dotted-quarter'}),
  '2/2':Object.freeze({id:'2/2',timeSignature:'2/2',label:'Cut time',numerator:2,denominator:2,barBeats:4,pulseBeats:2,pulsesPerBar:2,pulseUnit:'half'})
 });
 const meterFor=value=>{let id=typeof value==='string'?value:value?.id;if(['cut','cut-time','cuttime'].includes(id))id='2/2';return Object.prototype.hasOwnProperty.call(METERS,id)?METERS[id]:null;};
 const RARITIES=Object.freeze([
  {id:'common',label:'Common',rank:0,weight:52,bpm:76,window:.19,missLoss:7,extraLoss:4,description:'Quarter notes, eighth-note pairs, and clear rests.'},
  {id:'uncommon',label:'Uncommon',rank:1,weight:28,bpm:82,window:.185,missLoss:7,extraLoss:4,description:'Eighth notes, longer notes, and eighth through whole-bar rests.'},
  {id:'rare',label:'Rare',rank:2,weight:13,bpm:104,window:.18,missLoss:6,extraLoss:4,description:'Offbeat entrances, held syncopations, and short sixteenth-note groups.'},
  {id:'epic',label:'Epic',rank:3,weight:5,bpm:117,window:.175,missLoss:5,extraLoss:3,description:'Dotted notes and short sixteenth groups at a manageable pace.'},
  {id:'legendary',label:'Legendary',rank:4,weight:2,bpm:132,window:.17,missLoss:5,extraLoss:3,description:'Changing tempos, offbeat rests, and brief sixteenth-note bursts.'}
 ].map(Object.freeze));
 const SPECIES=[
  ['silver-minnow','Silver Minnow','common','#a7c8de','#eef9ff','slender',[5,12],4,8],
  ['cave-guppy','Cave Guppy','common','#8db0df','#eab1dd','round',[4,8],4,8],
  ['bluegill','Bluegill','common','#6b9ead','#e9ba6b','deep',[12,24],6,8],
  ['yellow-perch','Yellow Perch','common','#d6bc57','#445a70','striped',[15,32],6,9],
  ['brook-trout','Brook Trout','common','#6a9e91','#e8a995','spotted',[18,36],8,10],
  ['stone-loach','Stone Loach','common','#9e9588','#d5c5a2','long',[8,15],5,8],
  ['rainbow-trout','Rainbow Trout','uncommon','#9bbdc2','#e687b4','spotted',[24,48],12,12],
  ['crystal-carp','Crystal Carp','uncommon','#bdc5e8','#f0deac','round',[26,55],14,13],
  ['copper-catfish','Copper Catfish','uncommon','#b57d5b','#e5bf85','catfish',[22,50],14,13],
  ['moon-bream','Moon Bream','uncommon','#94b6c8','#e8e4c0','deep',[20,42],12,12],
  ['emerald-bass','Emerald Bass','uncommon','#4f9d86','#b5df96','broad',[25,52],16,14],
  ['ribbon-eel','Ribbon Eel','uncommon','#a28bc1','#e7b7f1','eel',[35,75],16,14],
  ['glass-cavefish','Glass Cavefish','rare','#b8e4df','#e6fff3','slender',[12,25],24,18],
  ['sapphire-pike','Sapphire Pike','rare','#507fc9','#9ce5ed','long',[45,90],28,20],
  ['amethyst-koi','Amethyst Koi','rare','#ad81cd','#f0bedc','round',[30,65],28,20],
  ['lantern-tench','Lantern Tench','rare','#d9a653','#a3f1b5','broad',[25,50],24,18],
  ['spotted-sturgeon','Spotted Sturgeon','rare','#8a9fc0','#d0e1ec','armoured',[60,110],32,22],
  ['velvet-char','Velvet Char','rare','#ab6c97','#f0be87','spotted',[25,55],26,19],
  ['opal-angelfish','Opal Angelfish','epic','#d3b3e7','#9ceadf','angel',[18,36],40,24],
  ['echo-salmon','Echo Salmon','epic','#de8b9e','#9cbcd8','slender',[45,85],44,25],
  ['golden-cave-carp','Golden Cave Carp','epic','#e6be53','#fff0aa','round',[35,75],48,26],
  ['aurora-eel','Aurora Eel','epic','#7fc6b5','#d59bda','eel',[70,130],48,26],
  ['midnight-catfish','Midnight Catfish','epic','#697cb8','#b5a1e2','catfish',[55,105],44,25],
  ['ruby-lionfish','Ruby Lionfish','epic','#d95d82','#f5b16a','spiny',[22,45],40,24],
  ['crescendo-coelacanth','Crescendo Coelacanth','legendary','#6b91bd','#bde9e0','armoured',[90,150],64,30],
  ['starlight-sturgeon','Starlight Sturgeon','legendary','#b3a7e7','#fff1b8','armoured',[120,200],72,32],
  ['prism-koi','Prism Koi','legendary','#9fe0cc','#eea5d1','round',[60,100],64,30],
  ['thunderfin-pike','Thunderfin Pike','legendary','#6e9ada','#f0d969','long',[100,170],72,32],
  ['royal-moonfish','Royal Moonfish','legendary','#b19ed4','#efd49c','deep',[70,120],80,35],
  ['luminous-dragonfish','Luminous Dragonfish','legendary','#7cc9c3','#e9a2cc','dragon',[90,160],80,35]
 ];
 // Tempo markings name quarter-note rates. The conducted meter pulse is
 // converted separately, so cut time never silently doubles a Presto speed.
 function tempoMarking(quarterBpm){
  if(quarterBpm>=168)return {marking:'Presto',meaning:'Very fast'};
  if(quarterBpm>=156)return {marking:'Vivace',meaning:'Lively'};
  if(quarterBpm>=120)return {marking:'Allegro',meaning:'Fast'};
  if(quarterBpm>=108)return {marking:'Moderato',meaning:'Moderately'};
  return {marking:'Andante',meaning:'Walking pace'};
 }
 function speciesTempo(rarity,index){
  const rank=RARITIES.find(value=>value.id===rarity).rank,range=rank===2?[96,112]:rank===3?[108,126]:rank===4?[120,144]:rank===1?[82,82]:[76,76];
  const change=rank<2?'steady':['accelerando','ritardando','steady','ritardando','steady','accelerando'][index%6],rawStart=change==='ritardando'?range[1]:change==='steady'?(range[0]+range[1])/2:range[0],rawEnd=change==='accelerando'?range[1]:change==='ritardando'?range[0]:rawStart;
  // Every advanced pattern pool includes sixteenth rhythms, including later
  // practice bars. Scale the entire curve so they never exceed 100 quarter
  // notes per minute, while accelerando and ritardando still change speed.
  const scale=rank<2?1:Math.min(1,MAX_SIXTEENTH_BPM/Math.max(rawStart,rawEnd)),start=rawStart*scale,end=rawEnd*scale;
  return Object.freeze({...tempoMarking(start),initialMarking:tempoMarking(start).marking,endMarking:tempoMarking(end).marking,unit:'quarter',change,startQuarterBpm:start,endQuarterBpm:end,rampAfterBars:1,rampBars:3});
 }
 const FISH=Object.freeze(SPECIES.map(([id,name,rarity,color,accent,shape,size,notes,xp],index)=>Object.freeze({
  id,name,rarity,rarityLabel:RARITIES.find(value=>value.id===rarity).label,rarityRank:RARITIES.find(value=>value.id===rarity).rank,
  color,accent,shape,silhouette:shape,size:Object.freeze(size),notes,reward:notes,rewardNotes:notes,xp,tempo:speciesTempo(rarity,index),patternIndex:index%6,meter:['4/4','6/8','2/2'][index%3],timeSignature:['4/4','6/8','2/2'][index%3],
  // Common/uncommon fish teach every meter. Some rarer species have one
  // meter habitat; others inhabit two. The preferred meter remains valid.
  meters:Object.freeze(['common','uncommon'].includes(rarity)?Object.keys(METERS):rarity==='legendary'||index%6<3?[['4/4','6/8','2/2'][index%3]]:[['4/4','6/8','2/2'][index%3],['4/4','6/8','2/2'][(index+1)%3]])
 })));
 const DURATIONS={h:2,q:1,e:.5,s:.25,dq:1.5,de:.75,rh:2,rq:1,re:.5,rs:.25,rdq:1.5,rw:4};
 const GLYPHS={h:'noteHalfUp',q:'noteQuarterUp',e:'note8thUp',s:'note16thUp',dq:'noteQuarterUp',de:'note8thUp',rh:'restHalf',rq:'restQuarter',re:'rest8th',rs:'rest16th',rdq:'restQuarter',rw:'restWhole'};
 // Six phrases at every rarity and meter alternate notes with silence. A
 // whole-bar rest is its own phrase, followed by a sounding phrase in rotation.
 const FOUR_FOUR={
  common:[['q','q','q','q'],['q','e','e','q','q'],['q','q','e','e','e','e'],['q','rq','q','q'],['h','rh'],['rw']],
  uncommon:[['q','rq','e','e','q'],['e','re','q','e','e','q'],['h','e','e','rq'],['rh','e','e','q'],['rq','q','e','re','q'],['rw']],
  rare:[['q','s','s','e','q','q'],['re','e','e','e','q','e','e'],['e','rs','s','q','e','e','q'],['e','q','e','rq','e','e'],['re','de','s','e','q','e','e'],['rh','re','s','s','e','e']],
  epic:[['dq','e','e','s','s','q'],['e','q','e','q','e','e'],['e','s','s','re','e','de','s','q'],['re','de','s','de','s','q','e'],['rs','de','e','q','de','s','e'],['rh','s','s','de','s','e']],
  legendary:[['de','s','e','re','s','s','e','q'],['e','q','s','s','re','e','q'],['s','s','e','de','s','e','re','q'],['rs','de','s','s','de','s','re','s','s','e'],['re','s','de','s','s','e','de','s','e'],['rh','e','de','s','e']]
 };
 const SIX_EIGHT={
  common:[['dq','dq'],['q','e','q','e'],['dq','e','e','e'],['q','e','rdq'],['rq','e','dq'],['rw']],
  uncommon:[['q','e','re','e','e'],['rdq','q','e'],['e','e','e','q','e'],['q','re','e','q'],['re','e','e','rdq'],['rw']],
  rare:[['e','s','s','e','q','e'],['re','e','e','e','s','s','e'],['q','s','s','re','e','e'],['e','dq','e','e'],['re','e','q','e','e'],['q','q','e','e']],
  epic:[['de','s','e','e','q'],['e','q','de','s','e'],['e','s','s','e','re','e','e'],['s','de','q','e','e'],['e','s','dq','s','e'],['rq','s','de','e','e']],
  legendary:[['de','s','e','e','s','s','e'],['re','s','s','e','de','s','e'],['s','s','e','de','s','e','e'],['s','e','dq','s','e'],['re','s','q','s','de','s'],['s','de','de','s','e','e']]
 };
 const CUT_TIME={
  common:[['h','h'],['h','q','q'],['q','q','h'],['h','rq','q'],['rh','q','q'],['rw']],
  uncommon:[['h','rq','q'],['q','e','e','h'],['rh','q','q'],['rq','q','e','re','q'],['e','re','q','h'],['rw']],
  rare:[['q','s','s','e','h'],['re','e','q','q','q'],['q','e','e','re','e','q'],['e','h','e','q'],['re','q','q','e','q'],['rh','e','e','q']],
  epic:[['dq','e','e','s','s','q'],['e','q','e','h'],['q','e','s','s','rq','q'],['de','dq','s','e','q'],['re','e','dq','s','s','q'],['rq','de','e','s','q','e']],
  legendary:[['de','s','e','re','s','s','e','q'],['e','q','s','s','re','e','q'],['s','s','e','de','s','e','re','q'],['s','de','dq','s','s','e','e'],['re','de','q','s','e','q'],['de','e','dq','s','e','e']]
 };
 const PATTERN_SOURCE={'4/4':FOUR_FOUR,'6/8':SIX_EIGHT,'2/2':CUT_TIME};
 const PATTERNS=Object.freeze(Object.values(METERS).flatMap(meter=>RARITIES.flatMap(rarity=>PATTERN_SOURCE[meter.id][rarity.id].map((tokens,index)=>{
  let beat=0;const events=tokens.map((token,at)=>{
   const wholeBarRest=token==='rw',duration=wholeBarRest?meter.barBeats:DURATIONS[token],rest=token[0]==='r',dotted=!wholeBarRest&&token.includes('d'),event={id:at,token,onset:beat,beat,duration,rest,type:rest?'rest':'note',glyph:GLYPHS[token],dotted,dots:dotted?1:0,flags:rest?0:duration<1?(duration===.25?2:1):0,...(wholeBarRest?{wholeBarRest:true,notationBeats:4}:{})};beat+=duration;return Object.freeze(event);
  });
  if(beat!==meter.barBeats)throw Error('Fishing rhythm '+meter.id+'/'+rarity.id+'/'+index+' must fill exactly one bar.');
  return Object.freeze({id:rarity.id+'-'+meter.id.replace('/','-')+'-'+index,rarity:rarity.id,meter:meter.id,beats:meter.barBeats,pulses:meter.pulsesPerBar,events:Object.freeze(events)});
 }))));
 const rarityFor=value=>RARITIES.find(rarity=>rarity.id===(typeof value==='string'?value:value?.rarity))||null;
 const fishFor=value=>FISH.find(fish=>fish.id===(typeof value==='string'?value:value?.id))||null;
 function drawRandom(random){const value=Number((typeof random==='function'?random:Math.random)());return Number.isFinite(value)?clamp(value,0,.999999999999):0;}
 function canFishInMeter(value,meter){const fish=fishFor(value),info=meterFor(meter);return !!fish&&!!info&&fish.meters.includes(info.id);}
 function availableFish(meter,rarity){const info=meter===undefined?null:meterFor(meter),rank=rarity===undefined?null:rarityFor(rarity);if(meter!==undefined&&!info||rarity!==undefined&&!rank)return [];return FISH.filter(fish=>(!info||fish.meters.includes(info.id))&&(!rank||fish.rarity===rank.id));}
 function chooseFish(options={}){
  if(options.meter!==undefined&&!meterFor(options.meter))throw Error('Choose 4/4, 6/8, or cut time.');
  const random=options.random||Math.random,eligible=availableFish(options.meter);let rarity=rarityFor(options.rarity);
  const availableRarities=RARITIES.filter(candidate=>eligible.some(fish=>fish.rarity===candidate.id));
  if(!rarity){let roll=drawRandom(random)*availableRarities.reduce((sum,value)=>sum+value.weight,0);rarity=availableRarities[availableRarities.length-1];for(const candidate of availableRarities){if(roll<candidate.weight){rarity=candidate;break;}roll-=candidate.weight;}}
  const choices=eligible.filter(fish=>fish.rarity===rarity?.id);if(!choices.length)throw Error('No fish of that rarity live in this time signature.');return choices[Math.floor(drawRandom(random)*choices.length)];
 }
 let serial=0;
 function sessionID(){try{if(typeof globalThis.crypto?.randomUUID==='function')return 'fishing-'+globalThis.crypto.randomUUID();}catch{}return 'fishing-'+Date.now().toString(36)+'-'+(++serial).toString(36)+'-'+Math.random().toString(36).slice(2,10);}
 function createSession(options={}){
  const practice=options.practice===true;
  const fish=options.fish===undefined?chooseFish(options):fishFor(options.fish);if(!fish)throw Error('Choose a known fish species.');
  const rarity=rarityFor(fish),meter=meterFor(options.meter||fish.meter);if(!meter)throw Error('Choose 4/4, 6/8, or cut time.');
  if(!canFishInMeter(fish,meter))throw Error(fish.name+' can only be caught in '+fish.meters.join(' or ')+'.');
  const profile=fish.tempo,q0=profile.startQuarterBpm,q1=profile.endQuarterBpm,startBeat=meter.barBeats*profile.rampAfterBars,endBeat=startBeat+meter.barBeats*profile.rampBars,slope=(q1-q0)/(endBeat-startBeat),changing=Math.abs(slope)>1e-10;
  const initialSecondsPerBeat=60/q0,initialSecondsPerPulse=initialSecondsPerBeat*meter.pulseBeats,countInBeats=meter.pulsesPerBar,countInSeconds=countInBeats*initialSecondsPerPulse;
  const startTime=Number.isFinite(options.startTime)?options.startTime:0,id=typeof options.id==='string'&&options.id.length?options.id.slice(0,180):sessionID(),musicStart=startTime+countInSeconds;
  const rampStartSeconds=startBeat*initialSecondsPerBeat,rampSeconds=changing?60/slope*Math.log(q1/q0):(endBeat-startBeat)*initialSecondsPerBeat,rampEndSeconds=rampStartSeconds+rampSeconds;
  // Integrate seconds per beat exactly. Every audible/visual/judged event uses
  // this immutable map, including a note sustained across the tempo ramp.
  function tempoAtBeat(beat){if(!Number.isFinite(beat))return NaN;return changing?q0+slope*clamp(beat-startBeat,0,endBeat-startBeat):q0;}
  function secondsAtBeat(beat){
   if(!Number.isFinite(beat))return NaN;
   if(!changing||beat<=startBeat)return beat*initialSecondsPerBeat;
   if(beat<endBeat)return rampStartSeconds+60/slope*Math.log1p(slope*(beat-startBeat)/q0);
   return rampEndSeconds+(beat-endBeat)*60/q1;
  }
  function timeAtBeat(beat){return musicStart+secondsAtBeat(beat);}
  function beatAtTime(time){
   if(!Number.isFinite(time))return NaN;const seconds=time-musicStart;
   if(!changing||seconds<=rampStartSeconds)return seconds/initialSecondsPerBeat;
   if(seconds<rampEndSeconds)return startBeat+q0*Math.expm1(slope*(seconds-rampStartSeconds)/60)/slope;
   return endBeat+(seconds-rampEndSeconds)*q1/60;
  }
  const patterns=PATTERNS.filter(pattern=>pattern.rarity===rarity.id&&pattern.meter===meter.id),events=[],pressedSources=new Map();
  let now=startTime,phase='count-in',progress=START_PROGRESS,hits=0,misses=0,extras=0,bar=0,sequence=0,lastJudgement=null,result=null,finished=false;
  function makeUntil(beat){
   while(bar*meter.barBeats<=beat){const pattern=patterns[(bar+fish.patternIndex)%patterns.length],barNumber=bar++;
    for(const source of pattern.events){const onset=barNumber*meter.barBeats+source.onset,time=timeAtBeat(onset),durationSeconds=timeAtBeat(onset+source.duration)-time,beam=Math.floor(source.onset/meter.pulseBeats),previous=events.at(-1);
     // Dense fast subdivisions need disjoint judgement windows. Written rest
     // boundaries count too, so tapping silence cannot steal a nearby target.
     const window=source.rest?0:Math.min(rarity.window,durationSeconds*.48,previous?(time-previous.time)*.48:Infinity);
     const requiresHold=!source.rest&&source.duration>=2;
     const holdTransitionFrom=!source.rest&&previous?.requiresHold&&Math.abs(previous.onset+previous.duration-onset)<1e-8?previous.id:null,transitionLateWindow=holdTransitionFrom?Math.max(window,Math.min(.18,durationSeconds*.5)):window;
     events.push({...source,id:'note-'+sequence++,bar:barNumber,pattern:pattern.id,meter:meter.id,onset,beat:onset,time,at:time,durationSeconds,window,judgementWindow:window,requiresHold,holdEndTime:requiresHold?timeAtBeat(onset+source.duration):null,holdReleaseWindow:requiresHold?Math.min(.18,durationSeconds*.35):0,holdTransitionFrom,transitionLateWindow,heldBy:null,holdLatched:false,holdReleased:false,pressedAt:null,beamingGroup:!source.rest&&source.duration<1?'beam-'+barNumber+'-'+beam:null,beam:!source.rest&&source.duration<1?beam:null,judgement:source.rest?'rest':'pending',restClean:true,restProgressAwarded:false,hitAt:null});
    }
   }
  }
  makeUntil(16);
  function tempoState(beat){const currentQuarterBpm=tempoAtBeat(beat),rampProgress=changing?clamp((beat-startBeat)/(endBeat-startBeat),0,1):0;return {...profile,...tempoMarking(currentQuarterBpm),currentQuarterBpm,currentPulseBpm:currentQuarterBpm/meter.pulseBeats,startBeat,endBeat,active:changing&&beat>=startBeat&&beat<endBeat,settled:changing&&beat>=endBeat,progress:rampProgress};}
  function finish(outcome,reason,finishedAt=now){
   if(finished)return;finished=true;phase=outcome;progress=outcome==='caught'?100:0;
   for(const event of events)if(event.judgement==='holding'){event.judgement='canceled';event.heldBy=null;event.holdLatched=false;}
   pressedSources.clear();
   const tempo=tempoState(beatAtTime(finishedAt));
   result={id,practice,fishId:fish.id,fish:copy(fish),rarity:fish.rarity,outcome,caught:outcome==='caught',reason:reason||null,hits,misses,extras,perfect:!practice&&hits>0&&misses===0&&extras===0,
    notes:!practice&&outcome==='caught'?fish.notes:0,xp:!practice&&outcome==='caught'?fish.xp:0,elapsed:Math.max(0,finishedAt-startTime),duration:Math.max(0,finishedAt-startTime-countInSeconds),bpm:tempo.currentPulseBpm,quarterBpm:tempo.currentQuarterBpm,tempo,meter:meter.id,timeSignature:meter.id,pulseUnit:meter.pulseUnit};
   try{options.onFinish?.(copy(result));}catch{/* Feedback cannot change a completed result. */}
  }
  function perfectEligible(){return !practice&&misses===0&&extras===0;}
  function completeCatch(){
   if(practice||finished||hits===0)return false;
   const perfectEndBeat=PERFECT_TARGET_BARS*meter.barBeats;
   // Finish the fourth written bar, including silence and the tails of holds.
   // A pending target cannot borrow its late window to qualify as perfect.
   const perfectReady=perfectEligible()&&now+1e-9>=timeAtBeat(perfectEndBeat)&&events.every(event=>{
    if(event.onset>=perfectEndBeat)return true;
    if(event.rest)return event.restClean&&event.restProgressAwarded;
    return event.judgement==='hit'&&now+1e-9>=timeAtBeat(event.onset+event.duration);
   });
   if(perfectReady){finish('caught',null,timeAtBeat(perfectEndBeat));return true;}
   if(progress>=100-1e-8&&now+1e-9>=timeAtBeat(TARGET_BARS*meter.barBeats)){finish('caught');return true;}
   return false;
  }
  function judge(kind,event){
   if(kind==='hit'){event.judgement='hit';event.hitAt=now;event.heldBy=null;event.holdLatched=false;hits++;progress=Math.min(100,progress+CLEAN_BAR_GAIN*event.duration/meter.barBeats);}
   else if(kind==='miss'){event.judgement='miss';event.heldBy=null;event.holdLatched=false;misses++;progress=Math.max(0,progress-rarity.missLoss);}
   else{extras++;progress=Math.max(0,progress-rarity.extraLoss);for(const rest of events)if(rest.rest&&rest.time<=now&&now<timeAtBeat(rest.onset+rest.duration))rest.restClean=false;}
   lastJudgement={kind,time:now,noteId:event?.id||null,progress};
   if(!practice&&!completeCatch()&&progress<=0)finish('escaped','rhythm');
  }
  // A successful physical hold earns breathing room for its adjacent target.
  // The 50% duration cap and the next note's 48% head cap keep dense windows
  // separate; a rest or an unsuccessful hold never grants this allowance.
  function lateWindow(event){
   if(!event.holdTransitionFrom)return event.window;
   const previous=events.find(item=>item.id===event.holdTransitionFrom);
   return previous?.judgement==='hit'&&previous.pressedAt!==null?event.transitionLateWindow:event.window;
  }
  function update(time){
   if(!Number.isFinite(time)||time<now||finished)return getState();now=time;
   const beat=beatAtTime(now);
   if(beat<0)return getState();phase='playing';
   for(const event of events){
    // A delayed frame must catch an already-clean fourth bar before it starts
    // judging unanswered notes from the fifth bar.
    if(perfectEligible()&&event.onset>=PERFECT_TARGET_BARS*meter.barBeats&&completeCatch())break;
    if(event.rest){
     // Listening through a rest is part of a clean bar. Tapping during its
     // silence forfeits this credit as well as applying the extra-tap loss.
     if(!event.restProgressAwarded&&now+1e-9>=timeAtBeat(event.onset+event.duration)){
      event.restProgressAwarded=true;
      if(event.restClean)progress=Math.min(100,progress+CLEAN_BAR_GAIN*event.duration/meter.barBeats);
     }
     continue;
    }
    if(event.judgement==='holding'){
     if(now+1e-9>=event.holdEndTime){judge('hit',event);if(finished)break;}
     continue;
    }
    if(event.time+lateWindow(event)>=now)break;
    if(event.judgement==='pending'){judge('miss',event);if(finished)break;}
   }
   completeCatch();
   if(!finished)makeUntil(beat+16);
   // Retain the nearby score for rendering; a long session must not grow forever.
   if(events.length>192){const remove=events.findIndex(event=>event.onset>=beat-8);if(remove>0)events.splice(0,remove);}
   return getState();
  }
  function nearestTarget(){
   let nearest=null,distance=Infinity;
   for(const event of events){if(event.judgement!=='pending')continue;const delta=Math.abs(event.time-now),window=now>=event.time?lateWindow(event):event.window;if(delta<=window&&delta<distance){nearest=event;distance=delta;}}
   return {nearest,distance};
  }
  // A discrete activation remains available for assistive technology and old
  // engine clients. Physical pointer/keyboard input uses press/release below.
  function tap(time){
   if(!Number.isFinite(time)||time<now)return {accepted:false,kind:'ignored',state:getState()};
   update(time);if(finished)return {accepted:false,kind:'finished',state:getState()};
   if(phase==='count-in')return {accepted:false,kind:'count-in',state:getState()};
   const {nearest}=nearestTarget();
   if(nearest){judge('hit',nearest);return {accepted:true,kind:'hit',noteId:nearest.id,error:now-nearest.time,state:getState()};}
   judge('extra');return {accepted:true,kind:'extra',state:getState()};
  }
  function sourceKey(value){return typeof value==='string'&&value.length>0&&value.length<=100?value:typeof value==='number'&&Number.isFinite(value)?String(value):null;}
  function press(time,sourceId='primary'){
   const source=sourceKey(sourceId);
   if(!source||!Number.isFinite(time)||time<now)return {accepted:false,kind:'ignored',state:getState()};
   update(time);if(finished)return {accepted:false,kind:'finished',state:getState()};
   if(pressedSources.has(source))return {accepted:false,kind:'held-source',state:getState()};
   if(pressedSources.size>=32)return {accepted:false,kind:'ignored',state:getState()};
   pressedSources.set(source,null);
   if(phase==='count-in')return {accepted:false,kind:'count-in',state:getState()};
   const {nearest}=nearestTarget();
   if(nearest){
    if(!nearest.requiresHold){judge('hit',nearest);return {accepted:true,kind:'hit',noteId:nearest.id,error:now-nearest.time,state:getState()};}
    nearest.judgement='holding';nearest.heldBy=source;nearest.holdLatched=false;nearest.holdReleased=false;nearest.pressedAt=now;pressedSources.set(source,nearest.id);
    lastJudgement={kind:'hold-start',time:now,noteId:nearest.id,progress};
    return {accepted:true,kind:'hold-start',noteId:nearest.id,error:now-nearest.time,state:getState()};
   }
   const detached=events.find(event=>event.judgement==='holding'&&event.holdLatched&&!event.holdReleased&&now<event.holdEndTime);
   if(detached){detached.heldBy=source;detached.holdLatched=false;pressedSources.set(source,detached.id);return {accepted:true,kind:'hold-resume',noteId:detached.id,state:getState()};}
   judge('extra');return {accepted:true,kind:'extra',state:getState()};
  }
  function release(time,sourceId='primary'){
   const source=sourceKey(sourceId);
   if(!source||!Number.isFinite(time))return {accepted:false,kind:'ignored',state:getState()};
   // Releasing a real pointer must not strand it if its queued event timestamp
   // is slightly older than the last animation frame; the score never rewinds.
   update(Math.max(now,time));
   if(!pressedSources.has(source))return {accepted:false,kind:finished?'finished':'ignored',state:getState()};
   const noteId=pressedSources.get(source);pressedSources.delete(source);
   const event=events.find(event=>event.id===noteId&&event.judgement==='holding'&&event.heldBy===source);
   if(!event)return {accepted:true,kind:'released',state:getState()};
   event.heldBy=null;
   if(now+event.holdReleaseWindow+1e-9>=event.holdEndTime){event.holdReleased=true;event.holdLatched=true;return {accepted:true,kind:'hold-release',noteId:event.id,state:getState()};}
   event.holdBroken=true;judge('miss',event);
   lastJudgement={...lastJudgement,kind:'hold-break',resultKind:'miss'};
   return {accepted:true,kind:'hold-break',noteId:event.id,state:getState()};
  }
  function releaseAllSources(options={}){
   if(options.preserveHolds===true){
    for(const event of events)if(event.judgement==='holding'){event.heldBy=null;event.holdLatched=true;}
    pressedSources.clear();
   }else for(const source of Array.from(pressedSources.keys()))release(now,source);
   return getState();
  }
  function noteState(event){return {...event,lateWindow:lateWindow(event),holdProgress:event.requiresHold?(event.judgement==='hit'?1:event.judgement==='holding'?clamp((now-event.time)/event.durationSeconds,0,1):0):0};}
  function getState(){const elapsed=Math.max(0,now-startTime),musicTime=now-musicStart,beat=beatAtTime(now),countInRemaining=Math.max(0,musicStart-now),tempo=tempoState(beat),secondsPerBeat=60/tempo.currentQuarterBpm,secondsPerPulse=secondsPerBeat*meter.pulseBeats,pulses=[],barLines=[];
   for(let pulse=Math.max(-meter.pulsesPerBar,Math.floor(beat/meter.pulseBeats)-1);pulse<=Math.ceil((beat+16)/meter.pulseBeats);pulse++){const at=pulse*meter.pulseBeats;pulses.push({id:'pulse-'+pulse,beat:at,time:timeAtBeat(at),strong:((pulse%meter.pulsesPerBar)+meter.pulsesPerBar)%meter.pulsesPerBar===0,countIn:pulse<0});}
   for(let line=Math.max(0,Math.floor(beat/meter.barBeats)-1);line<=Math.ceil((beat+16)/meter.barBeats);line++){const at=line*meter.barBeats;barLines.push({bar:line,beat:at,time:timeAtBeat(at)});}
   return {id,practice,phase,fish:copy(fish),rarity:copy(rarity),meter:meter.id,timeSignature:meter.id,meterInfo:{...meter},bpm:tempo.currentPulseBpm,displayBpm:tempo.currentPulseBpm,quarterBpm:tempo.currentQuarterBpm,tempo,startTime,musicStart,now,time:now,elapsed,musicTime,beat,secondsPerBeat,secondsPerPulse,pulseBeats:meter.pulseBeats,pulsesPerBar:meter.pulsesPerBar,pulseUnit:meter.pulseUnit,barBeats:meter.barBeats,countInBeats,countInQuarterBeats:meter.barBeats,countInSeconds,
    countInRemaining,countInBeat:phase==='count-in'?Math.max(1,Math.ceil(countInRemaining/initialSecondsPerPulse-1e-9)):0,pulses,barLines,
    progress:!finished&&beat<TARGET_BARS*meter.barBeats?Math.min(99,progress):progress,targetBars:perfectEligible()?PERFECT_TARGET_BARS:TARGET_BARS,perfectEligible:perfectEligible(),completedBars:result?.caught&&result.perfect?PERFECT_TARGET_BARS:Math.max(0,Math.floor((beat+1e-9)/meter.barBeats)),cleanBarsEquivalent:result?.caught&&result.perfect?PERFECT_TARGET_BARS:Math.max(0,(progress-START_PROGRESS)/CLEAN_BAR_GAIN),hits,misses,extras,window:rarity.window,lastJudgement:lastJudgement?{...lastJudgement}:null,
    pressedSources:Array.from(pressedSources.keys()),activeHolds:events.filter(event=>event.judgement==='holding').map(noteState),
    notes:events.filter(event=>event.onset+event.duration>=beat-8&&event.onset<=beat+16).map(noteState),result:result?copy(result):null};}
  return {update,tap,press,release,releaseAllSources,getState,snapshot:getState,timeAtBeat,beatAtTime,tempoAtBeat,abort(){if(!finished)finish('escaped','aborted');return getState();}};
 }
 return Object.freeze({FISH,RARITIES,METERS,PATTERNS,TARGET_BARS,PERFECT_TARGET_BARS,chooseFish,availableFish,canFishInMeter,fishFor,rarityFor,meterFor,tempoMarking,createSession});
});
