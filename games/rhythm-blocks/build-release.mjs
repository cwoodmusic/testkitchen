import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join,relative} from 'node:path';

export const GAME_ROOT=dirname(fileURLToPath(import.meta.url));
export const RUNTIME_FILES=Object.freeze([
  'chapter.mjs','chapter-content.mjs','dungeon-game.mjs','scenes.mjs',
  'assets/garden-porch.webp','assets/workshop-porch.webp','assets/canal-porch.webp',
  'game.html','app.mjs','audio.mjs','engine.mjs','journey.mjs','journey-view.mjs','lore.mjs',
  'mira.mjs','notation.mjs','opening.mjs','room.mjs','room-view.mjs','story.mjs','style.css',
  'assets/mira-walk.webp','assets/parcel-depot.webp','NOTATION-LICENSE.txt','NOTATION-SOURCES.md',
]);
const HASH_FILES=Object.freeze([...RUNTIME_FILES,'launcher.mjs','build-release.mjs']);
const read=(root,name)=>readFileSync(join(root,name));
const same=(left,right)=>left.equals(Buffer.isBuffer(right)?right:Buffer.from(right));

export function releaseVersion(root=GAME_ROOT){
  const hash=createHash('sha256');
  for(const name of HASH_FILES){const bytes=read(root,name);hash.update(`${name}\0${bytes.length}\0`);hash.update(bytes);}
  return `r-${hash.digest('hex').slice(0,16)}`;
}

function launcherPage(source,version){
  if(/<\/script/i.test(source))throw new Error('Launcher source cannot contain a script end tag.');
  const inline=source.replace(/^export /gm,'');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#292132">
<meta name="description" content="The Quiet Bell, a musical dungeon puzzle.">
<title>The Quiet Bell · Coda Arcade</title>
<style>html,body{margin:0;min-height:100%;background:#292132;color:#f4e8d0;font:16px/1.5 system-ui,sans-serif}main{min-height:100dvh;display:grid;place-content:center;gap:16px;padding:24px;box-sizing:border-box}h1,p{margin:0}p{max-width:32em}button{justify-self:start;min-height:44px;padding:10px 16px;font:inherit;background:#9bd5bb;color:#182d27;border:0}[hidden]{display:none!important}</style>
</head>
<body>
<main><h1>The Quiet Bell</h1><p id="quiet-bell-launch-status" role="status">Opening your journey…</p><button type="button" id="quiet-bell-launch-retry" hidden>Try again</button><noscript>This game needs JavaScript enabled.</noscript></main>
<script type="module">
${inline}
void launchQuietBell({fallbackVersion:${JSON.stringify(version)}});
</script>
</body>
</html>
`;
}

export function expectedRelease(root=GAME_ROOT){
  const version=releaseVersion(root),files=new Map();
  for(const name of RUNTIME_FILES){
    if(name==='game.html'){
      let html=read(root,name).toString('utf8');
      if(!/<head(?:\s[^>]*)?>/i.test(html)||/<base[\s>]/i.test(html))throw new Error('Game source needs a head and no base element.');
      html=html.replace(/<head(?:\s[^>]*)?>/i,head=>`${head}\n<meta name="quiet-bell-release" content="${version}">`);
      // The runtime base has two extra directories; the arcade keeps its package prefix.
      html=html.replaceAll('href="../../world-preview.html','href="../../../../world-preview.html');
      files.set('index.html',Buffer.from(html));
    }else files.set(name,read(root,name));
  }
  const manifest=JSON.stringify({schemaVersion:1,version},null,2)+'\n';
  return {version,files,manifest,launcher:launcherPage(read(root,'launcher.mjs').toString('utf8'),version)};
}

function packageFiles(root){
  if(!existsSync(root))return[];
  return readdirSync(root).flatMap(name=>{
    const target=join(root,name);
    return statSync(target).isDirectory()?packageFiles(target).map(child=>join(name,child)):[name];
  });
}

export function checkRelease(root=GAME_ROOT){
  const expected=expectedRelease(root),releaseRoot=join(root,'releases',expected.version),problems=[];
  for(const [name,bytes]of expected.files){
    const path=join(releaseRoot,name);
    if(!existsSync(path)||!same(readFileSync(path),bytes))problems.push(`Stale or missing release file: ${relative(root,path)}`);
  }
  for(const name of packageFiles(releaseRoot))if(!expected.files.has(name))problems.push(`Unexpected release file: ${name}`);
  for(const [name,bytes]of [['release.json',expected.manifest],['index.html',expected.launcher]]){
    const path=join(root,name);
    if(!existsSync(path)||!same(readFileSync(path),bytes))problems.push(`Stale or missing ${name}`);
  }
  return {version:expected.version,problems};
}

export function buildRelease(root=GAME_ROOT){
  const expected=expectedRelease(root),releaseRoot=join(root,'releases',expected.version);
  for(const [name,bytes]of expected.files){
    const target=join(releaseRoot,name);
    if(existsSync(target)&&!same(readFileSync(target),bytes))throw new Error(`Refusing to overwrite immutable release file: ${target}`);
  }
  for(const [name,bytes]of expected.files){const target=join(releaseRoot,name);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);}
  writeFileSync(join(root,'index.html'),expected.launcher);
  writeFileSync(join(root,'release.json'),expected.manifest);
  return {version:expected.version,files:expected.files.size};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.includes('--check')){
    const result=checkRelease();
    if(result.problems.length){console.error(result.problems.join('\n')+'\nRun node games/rhythm-blocks/build-release.mjs');process.exitCode=1;}
    else console.log(`Release ${result.version} matches its source.`);
  }else console.log(JSON.stringify(buildRelease()));
}
