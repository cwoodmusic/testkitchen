/* Hand-drawn replacement sources. Existing IDs and saved image data remain
 * portable; the original source collection stays available in decor/v1. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaPixelStyle=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const VERSION='east-west-20261101-1';
 const groups=[
  ['audio-register',1,3,['boombox','boombox-tower','notes-register']],
  ['floor-a',2,4,['neon-jukebox','rocket-statue','gumball-machine','star-pedestal','alien-statue','prize-capsule-machine','record-pedestal','neon-cactus']],
  ['floor-b',2,4,['arcade-trophy-pedestal','neon-arrow-sign','planet-sculpture','pixel-heart-totem','ticket-dispenser','prize-display','checker-flag-stand','mini-cabinet']],
  ['tabletop-a',2,4,['cube-lamp','succulent','vinyl-headphones','soda-cup','popcorn-tub','token-jar','mini-rocket','plasma-orb']],
  ['tabletop-b',2,4,['trophy','gamepad','headphone-stand','stacked-cassettes','desk-mushroom-lamp','lucky-cat','neon-game-over-sign','neon-high-score-sign']],
  ['wall-a',2,4,['neon-space-invader','neon-lightning-bolt','neon-music-note','wall-vinyl-record','neon-rainbow','neon-controller-sign','wall-art-orbit','wall-art-equalizer']],
  ['furniture-a',2,4,['sofa-south','sofa-compact-south','sofa-lounge-south','counter-jade-south','counter-boutique-south','desk-dj-south','table-candle-south','wall-art-keyboard']],
  ['furniture-b',2,4,['clothes-rack-south','wardrobe-south','table-rectangle-south','wall-art-sunset','table-lounge-walnut','wall-art-treble-clef','wall-art-bass-clef','wall-art-grand-staff']],
  ['wall-b',1,4,['wall-art-gold-record','wall-art-saxophone','wall-art-electric-guitars','wall-art-drum-kit']],
  ['rugs-a',2,4,['rug-notes-rectangle','rug-neon-oval','rug-pixel-round','rug-checker-square','rug-lightning-runner','rug-starburst','rug-controller','rug-hex-grid']],
  ['rugs-b',1,3,['rug-lounge-constellation','rug-lounge-sunset','rug-lounge-jade']],
  ['east-west-furniture',3,4,['couch-coral-east','couch-coral-west','couch-navy-east','couch-navy-west','armchair-amber-east','armchair-amber-west','chair-teal-east','chair-teal-west','counter-jade-east','counter-jade-west','table-lounge-east','table-lounge-west']]
 ];
 const SHEETS=Object.freeze(groups.map(([name,rows,columns,ids])=>Object.freeze({name,source:'assets/decor/source/handdrawn-'+name+'.png',rows,columns,ids:Object.freeze(ids)})));
 const ids=new Set(SHEETS.flatMap(sheet=>sheet.ids));
 const ENVIRONMENT=Object.freeze({
  'dance-couch-left-south.png':'sofa-south','dance-couch-right-south.png':'sofa-compact-south','lounge-couch-south.png':'sofa-lounge-south',
  'main-counter.png':'counter-jade-south','boutique-counter.png':'counter-boutique-south','dj-console.png':'desk-dj-south','table.png':'table-candle-south'
 });
 const ENVIRONMENT_FIT=Object.freeze({
  lounge_sofa:Object.freeze({source:[26,3,235,99],target:[13,38,262,67]}),
  dance_left_couch:Object.freeze({source:[3,23,158,105],target:[12,66,139,65]}),
  dance_right_couch:Object.freeze({source:[3,11,156,95],target:[20,52,121,57]})
 });
 const has=id=>ids.has(id);
 const imageURL=id=>'assets/decor/'+(has(id)?'handdrawn/v1/':'v1/')+id+'.png'+(has(id)?'?v='+VERSION:'');
 const facing=(id,category)=>id.endsWith('-east')?'east':id.endsWith('-west')?'west':id==='notes-register'?'north':category==='rug'?'top':'south';
 const facingLabel=(id,category)=>({east:'East-facing · right',west:'West-facing · left',north:'North-facing · rear view',top:'Top-down',south:'South-facing · front view'})[facing(id,category)];
 return Object.freeze({VERSION,SHEETS,ENVIRONMENT,ENVIRONMENT_FIT,has,imageURL,facing,facingLabel});
});
