/* Eight progression instruments, synthesized locally without audio samples. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.CodaSongSounds=value;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const EXTRA=Object.freeze([
  {id:10,name:'Crystal Harp',level:2},{id:11,name:'Neon Marimba',level:3},
  {id:12,name:'Cathedral Organ',level:4},{id:13,name:'Glass Choir',level:5},
  {id:14,name:'Velvet Pad',level:6},{id:15,name:'Starlight Lead',level:8},
  {id:16,name:'FM Electric Piano',level:10},{id:17,name:'Music Box',level:12}
 ].map(Object.freeze));
 function scheduleTone(ctx,pitch,when,length,sound,volume=.7,destination=ctx.destination,voices=[]){
  const id=Number(sound);if(!EXTRA.some(item=>item.id===id))return false;
  if(!Number.isFinite(volume)||volume<=0)return true;
  const frequency=440*2**((pitch-69)/12),duration=Math.max(.045,length),peak=Math.max(.0002,Math.min(1,volume)*.14),end=when+duration;
  const master=ctx.createGain();master.connect(destination);master.gain.setValueAtTime(.0001,when);
  let attack=.008,release=.12,decay=true;
  if(id===12){attack=.035;decay=false;release=.08;}
  if(id===13){attack=.09;decay=false;release=.2;}
  if(id===14){attack=.15;decay=false;release=.25;}
  if(id===15){attack=.02;decay=false;release=.1;}
  const apex=when+Math.min(attack,duration*.35);master.gain.exponentialRampToValueAtTime(peak,apex);
  if(!decay)master.gain.setValueAtTime(peak*.7,Math.max(apex,end-.03));
  master.gain.exponentialRampToValueAtTime(.0001,end+release);
  const profiles={
   10:[['triangle',1,.65],['sine',2,.25],['sine',3,.12]],
   11:[['sine',1,.8],['sine',3.98,.2]],
   12:[['sine',.5,.32],['sine',1,.5],['sine',2,.25],['sine',3,.1]],
   13:[['triangle',1,.4,-5],['sine',1,.35,5],['sine',3,.1]],
   14:[['sawtooth',1,.16,-7],['triangle',1,.44,7],['sine',.5,.18]],
   15:[['square',1,.22],['sine',2,.3],['triangle',1,.3,4]],
   16:[['sine',1,.72],['sine',2,.25],['sine',4,.1]],
   17:[['sine',2,.55],['sine',5.01,.12],['sine',1,.35]]
  };
  for(const [type,ratio,amount,detune=0] of profiles[id]){
   const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(frequency*ratio,when);oscillator.detune?.setValueAtTime(detune,when);gain.gain.value=amount;
   if(id===16&&ratio===2){gain.gain.setValueAtTime(amount,when);gain.gain.exponentialRampToValueAtTime(.001,end+.05);}
   oscillator.connect(gain).connect(master);oscillator.start(when);oscillator.stop(end+release+.02);voices.push(oscillator);
  }
  return true;
 }
 return Object.freeze({EXTRA,scheduleTone});
});
