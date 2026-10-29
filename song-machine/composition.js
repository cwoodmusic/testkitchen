/* Validate portable songs before replacing the editor or scheduling audio. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaSongComposition=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const METERS=Object.freeze(['4/4','2/4','3/4','5/4','6/8','9/8','12/8']);
 const SCALES=Object.freeze(['chromatic','major','minor','majorPent','minorPent']);
 const MAX_NOTES=8192,MAX_FILE_BYTES=2*1024*1024;
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const finite=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
 function normalize(song){
  if(!object(song)||!finite(song.bpm,40,240)||!Number.isInteger(song.bars)||song.bars<1||song.bars>16||!METERS.includes(song.meter))throw Error('Choose a song with 1–16 bars, a supported meter, and a tempo of 40–240 BPM.');
  if(!Array.isArray(song.tracks)||song.tracks.length>12||!Array.isArray(song.drums)||song.drums.length!==3)throw Error('A song needs up to 12 instruments and exactly three drum parts.');
  const maxSteps=16*24,ids=new Set();let count=0;
  function track(value,drum){
   if(!object(value)||!Array.isArray(value.notes)||(count+=value.notes.length)>MAX_NOTES)throw Error('The song contains invalid notes or more than '+MAX_NOTES+' notes.');
   const sound=value.sound??0,volume=value.volume??.7,mute=value.mute??false;
   if(!Number.isInteger(sound)||sound<0||sound>(drum?4:17)||!finite(volume,0,1)||typeof mute!=='boolean')throw Error('Each part needs a supported sound, volume, and mute setting.');
   const result={};
   if(!drum){
    if(!Number.isSafeInteger(value.id)||value.id<1||value.id>1000000000||ids.has(value.id))throw Error('Each instrument needs a unique numeric ID.');
    ids.add(value.id);
    const name=value.name===undefined?'Instrument '+value.id:value.name;
    if(typeof name!=='string'||name.length>100||value.clef!==undefined&&!['treble','bass'].includes(value.clef))throw Error('An instrument name or clef is invalid.');
    result.id=value.id;result.name=name;result.sound=sound;result.clef=value.clef||'treble';
   }else result.sound=sound;
   result.volume=volume;result.mute=mute;
   result.notes=Array.from(value.notes,note=>{
    if(!object(note)||!Number.isInteger(note.t)||note.t<0||note.t>=maxSteps||!finite(note.d,Number.MIN_VALUE,64)||(!drum||note.p!==undefined)&&(!Number.isInteger(note.p)||note.p<0||note.p>127))throw Error('A note has an invalid pitch, start, or length.');
    // Keep hidden later-bar notes and fractional written lengths intact.
    return note.p===undefined?{t:note.t,d:note.d}:{p:note.p,t:note.t,d:note.d};
   });
   return result;
  }
  return {bpm:song.bpm,meter:song.meter,bars:song.bars,root:Number.isInteger(song.root)&&song.root>=0&&song.root<12?song.root:0,scale:SCALES.includes(song.scale)?song.scale:'chromatic',tracks:Array.from(song.tracks,value=>track(value,false)),drums:Array.from(song.drums,value=>track(value,true))};
 }
 function validate(song){try{normalize(song);return true;}catch{return false;}}
 return Object.freeze({METERS,SCALES,MAX_NOTES,MAX_FILE_BYTES,normalize,validate});
});
