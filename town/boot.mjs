// The urban district is the town entrance. Authored maps use the same engine;
// the earlier valley remains available without replacing saved builder maps.
const townRoute=new URLSearchParams(location.search);
if(townRoute.get('original')==='1')await import('./town.mjs?v=urban-town-1');
else await import('./world/play.mjs?v=urban-town-1');
