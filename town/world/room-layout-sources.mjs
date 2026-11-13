/** Clone scene data without losing furniture-base identity or calibration marks.
 * Source alternatives belong to the outer editor controller, not a render scene. */
export function cloneRoomLayoutScene(scene){
 const seen=new WeakMap();
 function clone(value){
  if(!value||typeof value!=='object')return value;
  if(seen.has(value))return seen.get(value);
  const prototype=Object.getPrototypeOf(value);
  if(!Array.isArray(value)&&prototype!==Object.prototype&&prototype!==null)return value;
  const result=Array.isArray(value)?[]:{};seen.set(value,result);
  for(const [key,item]of Object.entries(value))if(key!=='roomLayoutLegacySources')result[key]=clone(item);
  // Base rectangles are intentionally non-enumerable on ordinary room items.
  // Reuse the same cloned rectangles when scene.solids references them too.
  const bases=Object.getOwnPropertyDescriptor(value,'collisionBoxes');
  if(bases&&'value'in bases)Object.defineProperty(result,'collisionBoxes',{...bases,value:clone(bases.value)});
  for(const symbol of Object.getOwnPropertySymbols(value)){
   const descriptor=Object.getOwnPropertyDescriptor(value,symbol);
   Object.defineProperty(result,symbol,'value'in descriptor?{...descriptor,value:clone(descriptor.value)}:descriptor);
  }
  return result;
 }
 return clone(scene);
}
