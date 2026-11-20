/** The launcher stays at the arcade's original address and never touches saves. */
export const validReleaseVersion=value=>typeof value==='string'&&value.length===18&&/^r-[0-9a-f]{16}$/.test(value);

export async function launchQuietBell({
  fallbackVersion,document=globalThis.document,location=globalThis.location,
  fetch=globalThis.fetch,manifestTimeoutMs=2500,releaseTimeoutMs=5000,view='game',
}={}){
  if(!validReleaseVersion(fallbackVersion))throw new TypeError('Invalid bundled release.');
  if(!['game','room-review'].includes(view))throw new TypeError('Invalid bundled view.');
  const base=new URL(view==='room-review'?'../':'./',location.href);
  const entry=view==='room-review'?'room-review.html':'index.html';
  const directory=version=>new URL(`releases/${version}/`,base);
  const escapeAttribute=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  async function read(url,options,timeout,parse){
    const controller=new AbortController();let timer;
    try{
      const response=(async()=>{
        const result=await fetch(url,{...options,credentials:'same-origin',mode:'same-origin',redirect:'error',signal:controller.signal});
        if(!result.ok)throw new Error('Release request failed.');
        return await parse(result);
      })();
      const deadline=new Promise((resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Release request timed out.'));},timeout);});
      return await Promise.race([response,deadline]);
    }finally{clearTimeout(timer);}
  }
  let selectedVersion=fallbackVersion;
  try{
    const manifestURL=new URL('release.json',base);
    manifestURL.searchParams.set('check',`${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const manifest=await read(manifestURL,{cache:'no-store',headers:{Accept:'application/json'}},manifestTimeoutMs,response=>response.json());
    if(manifest?.schemaVersion===1&&validReleaseVersion(manifest.version))selectedVersion=manifest.version;
  }catch{}
  for(const version of new Set([selectedVersion,fallbackVersion])){
    try{
      const releaseBase=directory(version);
      const html=await read(new URL(entry,releaseBase),{cache:'force-cache'},releaseTimeoutMs,response=>response.text());
      const marker=`<meta name="quiet-bell-release" content="${version}">`;
      if(!html.includes(marker)||!/<head(?:\s[^>]*)?>/i.test(html)||/<base[\s>]/i.test(html))throw new Error('Invalid release page.');
      const page=html.replace(/<head(?:\s[^>]*)?>/i,head=>`${head}<base href="${escapeAttribute(releaseBase.href)}">`);
      document.open();document.write(page);document.close();
      return {version,usedFallback:version!==selectedVersion};
    }catch{}
  }
  const status=document.getElementById('quiet-bell-launch-status');
  if(status)status.textContent=view==='room-review'?'Room review could not load. Check your connection and try again. Your saved comments are still on this device.':'The game could not load. Check your connection and try again. Your saved progress is still on this device.';
  const retry=document.getElementById('quiet-bell-launch-retry');
  if(retry){retry.hidden=false;retry.addEventListener('click',()=>location.reload(),{once:true});}
  return {version:null,usedFallback:true};
}
