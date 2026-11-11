// These spaces belong to each player's purchased décor, not shared templates.
// Keep the original geometry and return fresh rectangles to every caller.
export function apartmentDecorBounds(scene){
 if(scene?.kind!=='apartment'||scene.resident!=='player')return null;
 return [{x:1584,y:512,w:656,h:540},{x:710,y:130,w:780,h:500}];
}
export function apartmentWallDecorBounds(scene){
 if(scene?.kind!=='apartment'||scene.resident!=='player')return null;
 return [{x:380,y:4,w:650,h:98},{x:1280,y:4,w:280,h:98},{x:1760,y:4,w:140,h:98}];
}
