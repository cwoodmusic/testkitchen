/* Keep custom-domain cabinets on the same origin as their classroom profile. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CodaArcadeHost=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const CUSTOM_HOST='www.coda-arcade.com',CUSTOM_ORIGIN='https://'+CUSTOM_HOST;
 const GITHUB_ORIGIN='https://cwoodmusic.github.io';
 const customHosts=new Set([CUSTOM_HOST,'coda-arcade.com','www.coda-aracde.com','coda-aracde.com']);
 const paths=Object.freeze({pitch:'Pitch-Race',triad:'musictriad',rhythm:'rhythmroom'});
 function supports(hostname){return hostname==='cwoodmusic.github.io'||customHosts.has(hostname);}
 function gameURL(game,location,version=game==='pitch'?'freeze-104':'games-92'){
  if(!Object.prototype.hasOwnProperty.call(paths,game))throw new TypeError('Unknown arcade game.');
  // Profiles and embedded games must share this exact host's storage. Keep
  // earlier domain spellings working without moving their existing sessions.
  const origin=customHosts.has(location?.hostname)?'https://'+location.hostname:GITHUB_ORIGIN;
  const url=new URL('/'+paths[game]+'/',origin);
  url.searchParams.set('v',version);return url.href;
 }
 return Object.freeze({CUSTOM_HOST,CUSTOM_ORIGIN,supports,gameURL});
});
