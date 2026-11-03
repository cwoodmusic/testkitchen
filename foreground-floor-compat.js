/* Render-only compatibility for wall selections authored before the refreshed
 * architecture. Saved strokes and new foreground painting remain untouched. */
(function(root,factory){
 const common=typeof module==='object'&&module.exports;
 const geometry=common?require('./wall-reflections.js'):null;
 const api=factory((x,y)=>(geometry||root?.CodaWallReflections)?.isGlassFloor(x,y)===true);
 if(common)module.exports=api;if(root)root.CodaForegroundFloorCompat=api;
})(typeof window==='undefined'?null:window,function(isGlassFloor){
 'use strict';
 const HISTORICAL_WALL_STROKES=[{"tool":"paint","size":1,"points":[[385,272]],"selection":{"x":385,"y":272,"width":297,"height":80,"points":[[680,351],[386,350],[385,329],[387,327],[386,318],[390,314],[440,314],[440,275],[442,272],[596,272],[597,306],[599,307],[651,307],[655,311],[655,328],[657,330],[681,330],[681,351]]},"foreground":true,"depth":341},{"tool":"paint","size":1,"points":[[576,517]],"selection":{"x":576,"y":517,"width":130,"height":49,"points":[[705,517],[576,519],[580,563],[704,565],[704,537]]},"foreground":true,"depth":543},{"tool":"paint","size":1,"points":[[649,557]],"selection":{"x":649,"y":557,"width":27,"height":20,"points":[[649,563],[653,574],[674,576],[675,564],[655,557]]},"foreground":true,"depth":543},{"tool":"paint","size":1,"points":[[580,524]],"selection":{"x":580,"y":524,"width":163,"height":72,"points":[[580,546],[580,586],[714,595],[742,590],[737,563],[712,524]]},"foreground":true,"depth":543},{"tool":"paint","size":1,"points":[[569,505]],"selection":{"x":569,"y":505,"width":207,"height":124,"points":[[718,594],[773,628],[775,628],[774,542],[727,505],[575,507],[569,588]]},"foreground":true,"depth":543},{"tool":"paint","size":1,"points":[[440,490]],"selection":{"x":440,"y":490,"width":17,"height":18,"points":[[440,491],[450,490],[456,506],[441,507],[440,492]]},"foreground":true,"depth":535},{"tool":"paint","size":1,"points":[[440,492]],"selection":{"x":440,"y":492,"width":21,"height":17,"points":[[441,492],[445,492],[448,494],[450,496],[453,498],[452,499],[452,502],[457,504],[460,508],[440,507]]},"foreground":true,"depth":543},{"tool":"paint","size":1,"points":[[440,506]],"selection":{"x":440,"y":506,"width":38,"height":18,"points":[[440,507],[440,522],[464,523],[477,506],[461,506]]},"foreground":true,"depth":543},{"tool":"paint","size":1,"points":[[444,498]],"selection":{"x":444,"y":498,"width":17,"height":9,"points":[[460,506],[459,505],[453,498],[444,502]]},"foreground":true,"depth":543},{"tool":"paint","size":1,"points":[[442,492]],"selection":{"x":442,"y":492,"width":14,"height":9,"points":[[446,492],[448,492],[454,497],[455,500],[442,499]]},"foreground":true,"depth":535},{"tool":"paint","size":1,"points":[[462,506]],"selection":{"x":462,"y":506,"width":114,"height":21,"points":[[477,506],[575,506],[574,526],[462,524]]},"foreground":true,"depth":543}];
 // This follows the complete painted panels, including their grout, while
 // keeping the red front rail outside the floor. Animated panels are inset.
 const COLORED_FLOOR=Object.freeze([[181,668],[615,668],[679,834],[561,834],[548,845],[171,845],[138,817]].map(Object.freeze));
 // The older reflection clip extends across this newly drawn southwest rail.
 // Preserve its complete cap and face rather than treating its glow as glass.
 const SOUTHWEST_RAIL=Object.freeze([[44,790],[87,790],[87,812],[95,819],[123,819],[172,843],[269,843],[269,883],[44,883]].map(Object.freeze));
 function inside(polygon,x,y){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
 function fingerprint(stroke){
  if(!stroke||stroke.tool!=='paint'||!stroke.selection)return null;
  const s=stroke.selection;
  return JSON.stringify([stroke.tool,stroke.size,stroke.points,[s.x,s.y,s.width,s.height,s.points],stroke.foreground,stroke.depth]);
 }
 const fingerprints=new Set(HISTORICAL_WALL_STROKES.map(fingerprint));
 function isHistoricalWallStroke(stroke){const key=fingerprint(stroke);return key!==null&&fingerprints.has(key);}
 function isFloor(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&(isGlassFloor(x,y)||inside(COLORED_FLOOR,x,y));}
 function skipHistoricalFloor(stroke,x,y){return isHistoricalWallStroke(stroke)&&isFloor(x,y);}
 function structuralFloorPixel(part,x,y){return part?.name==='dance_lower_wall_left'&&!inside(SOUTHWEST_RAIL,x,y)&&isFloor(x,y);}
 return Object.freeze({COLORED_FLOOR,SOUTHWEST_RAIL,isFloor,isHistoricalWallStroke,skipHistoricalFloor,structuralFloorPixel});
});
