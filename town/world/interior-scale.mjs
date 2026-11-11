// Private rooms retain their authored furniture, geometry and saved placements.
// Calibrate their actors independently from the outdoor town and public halls.
export function interiorActorScale(scene){
 return scene?.kind==='apartment'||scene?.kind==='showroom' ? .75 : 1;
}
export function effectiveInteriorZoom(scene,zoom){
 return zoom/interiorActorScale(scene);
}
