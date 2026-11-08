/* The arcade's interior floor geometry, in original world pixels. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CodaArcadeFootprint=api;})(globalThis,function(){
 const width=1672,height=941;
 const floorPolys=[
 // Main floor, including the wide unbroken southeastern hall.
 [[647,282],[1558,282],[1558,799],[844,799],[844,466],[665,466],[665,310],[647,310]],
 // Northern main-room walkway and Piano Lab landing.
 [[649,220],[1553,220],[1553,391],[648,391]],
 // West connector around the boutique. The building stays open, with only a wall lip.
 [[381,216],[667,216],[667,489],[262,489],[262,347],[381,347]],
 // Lounge open seating and bottom-left approach.
 [[76,156],[477,156],[477,352],[383,352],[382,390],[215,390],[68,314]],
 // Walk-behind strip at the top of the nightclub retaining wall (marked in white).
 [[312,464],[800,464],[800,535],[312,535]],
 // Lounge staircase, down to boutique and east-to-west club connector.
 [[252,331],[338,331],[338,510],[253,510]],
 // Club's dance floor and side aisles.
 [[72,500],[822,500],[822,841],[70,841]],
 // East passage into the dance room below the upper wall.
 [[788,455],[876,455],[876,779],[739,779],[739,707],[788,707]],
 // Eastern arcade courtyard and accessible exit sign.
 [[842,397],[1580,397],[1580,800],[841,800]]
];
 const entrance={x:1477,y:799,inside:{x:1477,y:778}};
 const bounds={x:68,y:156,w:1512,h:685};
 const contains=(x,y)=>floorPolys.some(poly=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;});
 return Object.freeze({width,height,floorPolys,entrance,bounds,contains});
});
