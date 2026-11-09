// Match raw standalone packs to the softer lighting around Music Square.
// Finished scenes and construction already share their material donors with
// the ground; changing those here would break paving and cliff joins.
export function assetFilter(a){
 if(a.scene||a.pavingSource||a.group==='construction'||a.group==='cliff faces'||a.id==='coda-arcade')return 'none';
 if(a.group==='trees')return 'saturate(.8) brightness(.94)';
 if(a.pack==='town-decor-256'||a.pack==='town-leisure-38')return 'saturate(.84) brightness(.96)';
 if(a.pack==='urban-street-kit')return 'saturate(.9) brightness(.98)';
 if(['props','music','landscape'].includes(a.group))return 'saturate(.84) brightness(.96)';
 if(a.group==='furniture')return 'saturate(.88) brightness(.97)';
 if(a.group==='overgrowth')return 'saturate(.92) brightness(.98)';
 return 'none';
}
const cache=new WeakMap();
export function assetImage(a){
 const source=a.canvas,filter=assetFilter(a);if(filter==='none')return source;
 // Decoration canvases change identity when their full-resolution sheet loads.
 // Cache the grade against that identity so previews cannot replace native art.
 if(!cache.has(source)){const out=document.createElement('canvas');out.width=source.width;out.height=source.height;const c=out.getContext('2d');c.filter=filter;c.drawImage(source,0,0);cache.set(source,out);}
 return cache.get(source);
}
