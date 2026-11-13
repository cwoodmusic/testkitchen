import {createRoomLayoutModel} from './room-layout-model.mjs?v=town-compact-island-1';
import {createRoomLayoutStorage} from './room-layout-storage.mjs?v=town-compact-island-1';

export function roomLayoutThemeId(scene){
 if(scene?.kind==='showroom')return 'showroom-'+scene.showroomId;
 if(scene?.kind==='apartment')return scene.resident||'player';
 return null;
}

/** Builder templates change the authored room; personal purchases stay separate. */
export function createRoomLayoutResolver({storage,owner='builder',events=globalThis}={}){
 const store=createRoomLayoutStorage({storage,owner});let cache=new WeakMap();
 const invalidate=()=>{cache=new WeakMap();};
 const changed=event=>{if(!event.detail?.owner||event.detail.owner===owner)invalidate();};
 const stored=event=>{if(event.key==null||event.key===store.key)invalidate();};
 events.addEventListener?.('coda-room-layout-change',changed);
 events.addEventListener?.('storage',stored);
 return {
  resolve(base,catalog){
   const themeId=roomLayoutThemeId(base);if(!themeId||!catalog?.get)return base;
   const remembered=cache.get(base);if(remembered?.catalog===catalog)return remembered.scene;
   let scene=base;const saved=store.load(themeId);
   if(saved.ok&&saved.record)try{scene=createRoomLayoutModel({themeId,scene:base,catalog,record:saved.record}).scene;}catch{/* Preserve incompatible saves and use the authored room. */}
   cache.set(base,{catalog,scene});return scene;
  },
  invalidate,
  dispose(){events.removeEventListener?.('coda-room-layout-change',changed);events.removeEventListener?.('storage',stored);invalidate();}
 };
}
