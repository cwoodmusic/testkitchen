// Shared by timber artwork and under-deck collision. Decks and terrain keep
// their own geometry; these anchors describe only the supporting square posts.
export const PIER_POST_WIDTH=22,PIER_POST_DEPTH=12,PIER_POST_Y_INSET=8;
export const PIER_POST_CENTRES=Object.freeze([11,53]);

export function pierPostCentres(x,y,joins){
 const result=[],worldY=(y+1)*64-PIER_POST_Y_INSET;
 if(!joins.south||y%2===0){
  if(!joins.west||x%2===0)result.push({x:x*64+PIER_POST_CENTRES[0],y:worldY});
  if(!joins.east)result.push({x:x*64+PIER_POST_CENTRES[1],y:worldY});
 }
 return result;
}
