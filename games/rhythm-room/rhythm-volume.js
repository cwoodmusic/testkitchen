/* Device-wide listening level. Every voice shares one gain on the audio clock. */
(function(root,factory){
 const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RhythmRoomVolume=api;
})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const KEY='rhythmRoomVolumeV1',RAMP_SECONDS=.025;
 function number(value){
  if(typeof value==='string'){if(!value.trim())return null;value=Number(value);}
  return typeof value==='number'&&Number.isFinite(value)?Math.min(100,Math.max(0,value)):null;
 }
 function create(api={}){
  let storage=api.storage,error='',persisted=false;
  if(storage===undefined)try{storage=root?.localStorage;}catch{}
  const initial=number(api.defaultValue)??100;
  let value=initial,node=null,context=null;
  try{const raw=storage?.getItem?.(KEY),saved=raw===null||raw===undefined?null:number(raw);if(saved!==null){value=saved;persisted=true;}}
  catch{error='This device could not reopen its volume setting.';}
  const now=audio=>typeof audio?.currentTime==='number'&&Number.isFinite(audio.currentTime)?Math.max(0,audio.currentTime):0;
  function setInitial(gain,audio){
   const parameter=gain.gain,target=value/100;
   try{if(typeof parameter.setValueAtTime==='function')parameter.setValueAtTime(target,now(audio));else parameter.value=target;}
   catch{parameter.value=target;}
  }
  function applyLevel(){
   if(!node||!context)return;const parameter=node.gain,time=now(context),target=value/100;
   try{
    if(typeof parameter.linearRampToValueAtTime!=='function'){parameter.value=target;return;}
    // Holding the active ramp prevents jumps when the slider moves repeatedly.
    let held=false;
    if(typeof parameter.cancelAndHoldAtTime==='function')try{parameter.cancelAndHoldAtTime(time);held=true;}catch{}
    if(!held){const current=Number.isFinite(parameter.value)?parameter.value:target;parameter.cancelScheduledValues?.(time);parameter.setValueAtTime?.(current,time);}
    parameter.linearRampToValueAtTime(target,time+RAMP_SECONDS);
   }catch{parameter.value=target;}
  }
  function state(){return {value,persisted,error,connected:node!==null};}
  function setValue(input){
   const next=number(input);if(next===null)return value;const changed=next!==value;value=next;
   if(changed)applyLevel();
   try{if(typeof storage?.setItem!=='function')throw Error('storage');storage.setItem(KEY,String(value));persisted=true;error='';}
   catch{persisted=false;error='Volume works for this visit, but this device could not save the setting.';}
   if(changed)try{api.onChange?.(value,state());}catch{}
   return value;
  }
  function disconnect(){const previous=node;node=null;context=null;if(previous)try{previous.disconnect();}catch{}}
  function connect(audio){
   if(!audio||typeof audio.createGain!=='function'||!audio.destination||audio.state==='closed')throw TypeError('Choose an active audio context for volume.');
   if(node&&context===audio)return node;
   const next=audio.createGain();
   try{setInitial(next,audio);next.connect(audio.destination);}catch(error){try{next.disconnect();}catch{}throw error;}
   disconnect();node=next;context=audio;return node;
  }
  return Object.freeze({getValue:()=>value,setValue,connect,disconnect,getGainNode:()=>node,getState:state});
 }
 return Object.freeze({KEY,RAMP_SECONDS,create});
});
