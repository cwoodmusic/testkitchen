const revisions=new WeakMap();
const pixelWrites=['clearRect','fillRect','strokeRect','drawImage','putImageData','fill','stroke','fillText','strokeText','reset'];

// Native art is normally static. Observe only its own canvas context so an
// in-place source edit invalidates terrain chunks without per-frame pixel reads.
export function artSourceVersion(source){
 if(!source||typeof source!=='object'&&typeof source!=='function')return 0;
 let state=revisions.get(source);if(state)return state.version;
 state={version:0};revisions.set(source,state);
 const ctx=source.getContext?.('2d');
 if(ctx)for(const name of pixelWrites){
  const original=ctx[name];if(typeof original!=='function')continue;
  try{ctx[name]=function(...args){state.version++;return original.apply(this,args);};}catch{}
 }
 return state.version;
}

export function invalidateArtSource(source){artSourceVersion(source);const state=revisions.get(source);if(state)state.version++;}
