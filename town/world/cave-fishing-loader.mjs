let promise;
export function loadCaveFishing(){
 if(promise)return promise;
 promise=(async()=>{
  for(const path of ['music-notation.css','rhythm-fishing.css','fishing-battle.css','fishing-practice.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../../'+path+'?v=town-flight-1',import.meta.url);document.head.append(link);}
  const files=['music-notation.js','rhythm-beaming.js','fishing-water-regions.js','fishing-water.js','fishing-cave-layout.js','fishing-biomes.js','rhythm-fishing-engine.js','fishing-journal.js','fishing-cave-effects.js','fish-shadow-motion.js','fishing-battle.js','fishing-music.js','fishing-boat.js','fishing-rhythm-input.js','fishing-practice.js','rhythm-fishing.js'];
  for(const path of files)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('../../'+path+'?v=town-flight-1',import.meta.url);script.onload=resolve;script.onerror=()=>reject(Error('Fishing could not load. Please try again.'));document.head.append(script);});
  await window.CodaMusicNotation?.load();return window.CodaRhythmFishing;
 })().catch(error=>{promise=null;throw error;});return promise;
}
