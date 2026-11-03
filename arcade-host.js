/* Cabinets ship with the arcade and share their parent profile's origin. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CodaArcadeHost=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const CUSTOM_HOST='www.coda-arcade.com',CUSTOM_ORIGIN='https://'+CUSTOM_HOST;
 const GITHUB_ORIGIN='https://cwoodmusic.github.io';
 const customHosts=new Set([CUSTOM_HOST,'coda-arcade.com','www.coda-aracde.com','coda-aracde.com']);
 const paths=Object.freeze({pitch:'games/pitch-race/',triad:'games/music-triad/',rhythm:'games/rhythm-room/'});
 function supports(hostname){return hostname==='cwoodmusic.github.io'||customHosts.has(hostname);}
 function packageBase(location){
  const hostname=location?.hostname,custom=customHosts.has(hostname),github=hostname==='cwoodmusic.github.io',local=['localhost','127.0.0.1','[::1]'].includes(hostname);
  const fallback=new URL(github||!custom&&!local?GITHUB_ORIGIN+'/coda-arcade/':'https://'+hostname+'/');
  if(!custom&&!github&&!local)return fallback;
  try{
   const current=new URL(location?.href||location?.pathname||fallback.href,fallback);
   if(current.hostname!==hostname||current.username||current.password||!['http:','https:'].includes(current.protocol))return fallback;
   if(!local){current.protocol='https:';current.port='';}
   return new URL('./',current);
  }catch{return fallback;}
 }
 function gameURL(game,location,version='bundled-profile-names-1'){
  if(!Object.prototype.hasOwnProperty.call(paths,game))throw new TypeError('Unknown arcade game.');
  // Resolve from the current app directory, including GitHub Pages project
  // prefixes. Test Kitchen loads its own copies instead of live game repos.
  const url=new URL(paths[game],packageBase(location));
  url.searchParams.set('v',version);return url.href;
 }
 return Object.freeze({CUSTOM_HOST,CUSTOM_ORIGIN,supports,gameURL});
});
