/* Instrument envelopes and acoustic/electronic percussion for the ten stage styles. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaDanceSongAudio=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const noiseBuffers=new WeakMap();
 function voiceProfile(sound,style){
  const presets=[
   {partials:[['square',1,.55],['sine',1,.2]],attack:.004,hold:true,cutoff:3800},
   {partials:[['triangle',1,1]],attack:.012,hold:false,cutoff:2400},
   {partials:[['sine',1,.68],['triangle',2,.22],['sine',3,.08]],attack:.005,hold:false,cutoff:3200},
   {partials:[['sine',1,.7],['sine',2.76,.25],['sine',5.4,.12]],attack:.002,hold:false,cutoff:7000},
   {partials:[['sine',1,.6],['sine',2,.25],['sine',4,.13],['sine',.5,.18]],attack:.016,hold:true,cutoff:4500},
   {partials:[['sawtooth',1,.24,-6],['sawtooth',1,.24,6],['triangle',1,.35]],attack:.09,hold:true,cutoff:1600},
   {partials:[['sine',1,.88],['sine',2,.11]],attack:.035,hold:true,cutoff:5000},
   {partials:[['sine',1,.7],['triangle',1,.35]],attack:.006,hold:false,cutoff:800},
   {partials:[['triangle',1,.75],['sine',2,.18]],attack:.003,hold:false,cutoff:3000},
   {partials:[['sawtooth',1,.35],['square',1,.15],['sine',1,.35]],attack:.018,hold:true,cutoff:2800}
  ];
  if(style==='march'&&sound===1)return {partials:[['sine',1,.48],['sine',2,.27],['sine',3,.18],['sawtooth',1,.12]],attack:.018,hold:true,cutoff:3600,sweep:1600};
  if(style==='jig'&&sound===6)return {partials:[['sine',1,.82],['sine',2,.18],['sine',3,.05]],attack:.012,hold:true,cutoff:5200};
  if(style==='jig'&&sound===5)return {partials:[['sawtooth',1,.32],['triangle',1,.5]],attack:.035,hold:true,cutoff:2200};
  if(style==='jazz'&&sound===2)return {partials:[['sine',1,.8],['sine',2.01,.17],['sine',4,.07]],attack:.006,hold:false,cutoff:6000};
  if(style==='latin'&&sound===3)return {partials:[['sine',1,.9],['sine',3.98,.18]],attack:.002,hold:false,cutoff:7000};
  if(style==='funk'&&sound===8)return {partials:[['sawtooth',1,.36],['triangle',1,.55]],attack:.002,hold:false,cutoff:1900,sweep:450};
  return presets[sound]||presets[1];
 }
 function register(source,nodes,remember){
  if(remember){remember(source,nodes);return;}
  source.onended=()=>{try{source.disconnect();for(const node of nodes)node.disconnect();}catch{}};
 }
 function pitched(ctx,dest,frequency,at,duration,volume,profile,remember,slide){
  const end=at+Math.max(.035,duration);
  for(const [type,ratio,amount,detune=0]of profile.partials){
   const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),attack=at+Math.min(profile.attack,(end-at)*.35),peak=Math.max(.0002,volume*amount);
   osc.type=type;osc.codaDancePart='backing';osc.frequency.setValueAtTime(frequency*ratio,at);osc.detune.setValueAtTime(detune,at);if(slide)osc.frequency.exponentialRampToValueAtTime(slide*ratio,end);
   filter.type='lowpass';filter.frequency.setValueAtTime(profile.cutoff,at);if(profile.sweep)filter.frequency.exponentialRampToValueAtTime(profile.sweep,end);
   gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(peak,attack);
   if(profile.hold)gain.gain.exponentialRampToValueAtTime(peak*.7,Math.max(attack,end-Math.min(.09,(end-at)*.25)));
   gain.gain.exponentialRampToValueAtTime(.0001,end);
   osc.connect(filter).connect(gain).connect(dest);register(osc,[filter,gain],remember);osc.start(at);osc.stop(end+.012);
  }
 }
 function noise(ctx,dest,at,duration,volume,cutoff,remember){
  let buffer=noiseBuffers.get(ctx);if(!buffer){buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.6),ctx.sampleRate);const samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;noiseBuffers.set(ctx,buffer);}
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;source.codaDancePart='backing';filter.type='highpass';filter.frequency.value=cutoff;
  gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+.002);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(filter).connect(gain).connect(dest);register(source,[filter,gain],remember);source.start(at);source.stop(at+duration+.01);
 }
 function schedule(ctx,event,at,duration,dest,style,remember){
  if(!ctx||!event||!Number.isFinite(at)||!Number.isFinite(duration)||duration<=0||!(event.volume>0))return false;
  if(event.part==='tone')pitched(ctx,dest,440*2**((event.midi-69)/12),at,duration,event.volume*.18,voiceProfile(event.sound,style),remember);
  else if(event.part==='drum'){
   const row=event.track,v=event.volume,acoustic=['waltz','jig','march','jazz','orchestral','blues'].includes(style);
   if(row===0&&style==='jig'){pitched(ctx,dest,95,at,.19,v*.32,{partials:[['sine',1,1],['sine',1.53,.18]],attack:.003,hold:false,cutoff:900},remember);noise(ctx,dest,at,.045,v*.06,1800,remember);}
   else if(row===0){const timpani=style==='orchestral',conga=style==='latin',frequency=timpani?82:conga?190:acoustic?110:145,end=timpani?62:conga?125:45;
    pitched(ctx,dest,frequency,at,timpani?.42:conga?.13:style==='chiptune'?.09:.17,v*(acoustic?.34:.55),{partials:[['sine',1,1]],attack:.004,hold:false,cutoff:1200},remember,end);
   }else if(row===1&&style==='latin')pitched(ctx,dest,1150,at,.045,v*.5,{partials:[['sine',1,1],['triangle',1.4,.25]],attack:.002,hold:false,cutoff:6000},remember);
   else if(row===1){noise(ctx,dest,at,style==='jazz'||style==='waltz'?.20:style==='chiptune'?.045:.12,v*(acoustic?.25:.4),style==='jig'?3500:style==='chiptune'?4500:1200,remember);if(style==='march')pitched(ctx,dest,180,at,.075,v*.18,{partials:[['triangle',1,1]],attack:.002,hold:false,cutoff:1500},remember);}
   else noise(ctx,dest,at,style==='jazz'?.22:style==='orchestral'?.4:style==='jig'?.08:.055,v*(style==='orchestral'?.6:.4),style==='jazz'?4500:style==='jig'?3500:6500,remember);
  }else return false;
  return true;
 }
 return Object.freeze({schedule,voiceProfile});
});
