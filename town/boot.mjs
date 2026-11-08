// Authored maps and the editor use one world engine. The existing handcrafted
// town remains available without changing its NPC and friendship progression.
if(new URLSearchParams(location.search).get('map')==='builder')await import('./world/play.mjs?v=walk-scale-1');
else await import('./town.mjs?v=walk-scale-1');
