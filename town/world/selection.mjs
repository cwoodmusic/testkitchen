// Editor-only selection masks; absent cells means the complete rectangle.
const masks=new WeakMap();
export function selectionContains(r,x,y){if(!r||x<r.x0||x>r.x1||y<r.y0||y>r.y1)return false;if(!r.cells)return true;if(!masks.has(r))masks.set(r,new Set(r.cells));return masks.get(r).has(`${x},${y}`);}
export function selectionCount(r){if(!r)return 0;return r.cells?new Set(r.cells).size:(r.x1-r.x0+1)*(r.y1-r.y0+1);}
export function* selectionTiles(r){if(!r)return;for(let y=r.y0;y<=r.y1;y++)for(let x=r.x0;x<=r.x1;x++)if(selectionContains(r,x,y))yield [x,y];}
