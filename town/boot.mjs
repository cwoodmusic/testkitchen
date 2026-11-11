// Urban buildings and street pieces are builder assets. Their example scene
// is optional; opening the town keeps the existing town route.
const townRoute=new URLSearchParams(location.search);
if(townRoute.get('map')==='builder'||townRoute.get('urban')==='1')await import('./world/play.mjs?v=room-editor-1');
else await import('./town.mjs?v=room-editor-1');
