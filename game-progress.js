// Client-reported cosmetic achievements. These are not verified Hall of Fame scores.
const codaProgress=(()=>{
 const definitions=[
 ['pixelheadphones','Triple Threat','Complete one round of all three games.',s=>s.pitchRounds>0&&s.triadRounds>0&&s.rhythmRounds>0],
 ['backwardcap','High Five','Complete 5 games total.',s=>s.totalRounds>=5],
 ['guitarbag','On Tour','Complete 25 games total.',s=>s.totalRounds>=25],
 ['noteclip','Opening Notes','Correctly identify 10 notes in Pitch Race.',s=>s.pitchCorrect>=10],
 ['lightningglasses','Note Streak','Identify 10 notes in a row without a mistake.',s=>s.pitchStreak>=10],
 ['racehelmet','Speed Reader','Win a classic Pitch Race against the computer.',s=>s.pitchWins>=1],
 ['starglasses','Personal Best','Beat a previous completed-run score in the same Pitch Race mode.',s=>s.pitchImproved>=1],
 ['clefcrown','Pitch Perfect','Finish a classic race with correct notes and no mistakes.',s=>s.pitchPerfect>=1],
 ['wizardhat','First Capture','Complete a Music Triad match in which you capture a card.',s=>s.triadCaptures>=1],
 ['staff','Thinking Ahead','Win a Music Triad match against the computer.',s=>s.triadWins>=1],
 ['cape','Comeback Kid','Complete a Music Triad win after trailing.',s=>s.triadComebacks>=1],
 ['cardfriend','Card Collector','Capture 50 cards across completed Music Triad matches.',s=>s.triadCaptures>=50],
 ['crown','Triad Royalty','Win 10 Music Triad matches against the computer.',s=>s.triadWins>=10],
 ['wristbands','Finding the Beat','Complete a tap round containing notes.',s=>s.rhythmRounds>=1],
 ['buckethat','In the Pocket','Reach 80% tap accuracy.',s=>s.rhythmBest>=80],
 ['drumbag','Steady Hands','Complete 5 tap rounds at 90% accuracy or better.',s=>s.rhythm90>=5],
 ['robothelmet','Rhythm Machine','Match every note with no extras, early taps, or late taps.',s=>s.rhythmPerfect>=1],
 ['drumfriend','Beat Keeper','Complete 20 tap rounds containing notes.',s=>s.rhythmRounds>=20]
 ];
 const numeric=['totalRounds','pitchRounds','pitchCorrect','pitchStreak','pitchWins','pitchImproved','pitchPerfect','pitchBestClassic','pitchBestEndless','pitchBestLevels','pitchBestMulti','triadRounds','triadCaptures','triadWins','triadComebacks','rhythmRounds','rhythmBest','rhythm90','rhythmPerfect'];
 function clean(raw){const out={};for(const k of numeric)out[k]=Number.isFinite(raw?.[k])?Math.max(0,Math.min(10000000,raw[k])):0;out.seen=Array.isArray(raw?.seen)?raw.seen.filter(x=>typeof x==='string'&&x.length<160).slice(-300):[];return out}
 function stats(){return clean(data.gameStats)}
 function unlocked(id,s=stats()){if(id==='rainbowtrail'){return [['noteclip','lightningglasses','racehelmet','starglasses','clefcrown'],['wizardhat','staff','cape','cardfriend','crown'],['wristbands','buckethat','drumbag','robothelmet','drumfriend']].every(group=>group.filter(k=>unlocked(k,s)).length>=3)}if(id==='discohelmet')return definitions.every(d=>d[3](s))&&unlocked('rainbowtrail',s)&&data.customized===true&&data.walked>=450;return Boolean(definitions.find(d=>d[0]===id)?.[3](s))}
 let session=null;
 const integer=(x,max=1000000)=>Number.isFinite(x)&&x>=0&&x<=max&&Number.isInteger(x);
 function valid(game,r){if(!r||typeof r!=='object')return false;if(game==='pitch')return ['classic','endless','levels','multi'].includes(r.mode)&&integer(r.score)&&integer(r.correct)&&integer(r.misses)&&integer(r.streak)&&r.streak<=r.correct&&typeof r.won==='boolean'&&typeof r.perfect==='boolean';if(game==='triad')return ['computer','multiplayer'].includes(r.mode)&&integer(r.captures,1000)&&integer(r.score,16)&&typeof r.won==='boolean'&&typeof r.comeback==='boolean';return game==='rhythm'&&r.mode==='tap'&&integer(r.total,128)&&r.total>0&&integer(r.hits,128)&&r.hits<=r.total&&integer(r.extra,1000)&&integer(r.early,128)&&integer(r.late,128)&&r.early+r.late<=r.hits}
 function apply(game,runId,r){if(!valid(game,r))return false;const s=stats(),key=game+':'+runId;if(s.seen.includes(key))return false;const before=new Set([...definitions.map(d=>d[0]),'rainbowtrail','discohelmet'].filter(id=>unlocked(id,s)));s.seen.push(key);s.seen=s.seen.slice(-300);s.totalRounds++;
 if(game==='pitch'){const bestKey={classic:'pitchBestClassic',endless:'pitchBestEndless',levels:'pitchBestLevels',multi:'pitchBestMulti'}[r.mode];const prior=s[bestKey];if(prior>0&&r.score>prior)s.pitchImproved++;s[bestKey]=Math.max(prior,r.score);s.pitchRounds++;s.pitchCorrect+=r.correct;s.pitchStreak=Math.max(s.pitchStreak,r.streak);if(r.mode==='classic'&&r.won)s.pitchWins++;if(r.mode==='classic'&&r.correct>0&&r.misses===0)s.pitchPerfect++}
 if(game==='triad'){s.triadRounds++;s.triadCaptures+=r.captures;if(r.mode==='computer'&&r.won)s.triadWins++;if(r.comeback&&r.won)s.triadComebacks++}
 if(game==='rhythm'){const accuracy=100*r.hits/(r.total+r.extra);s.rhythmRounds++;s.rhythmBest=Math.max(s.rhythmBest,accuracy);if(accuracy>=90)s.rhythm90++;if(r.hits===r.total&&r.extra===0&&r.early===0&&r.late===0)s.rhythmPerfect++}
 data.gameStats=clean(s);save();if(typeof arcadeAccounts!=='undefined')arcadeAccounts.sync();const rewards=[...definitions.map(d=>d[0]),'rainbowtrail','discohelmet'].filter(id=>!before.has(id)&&unlocked(id));if(rewards.length)toast('Achievement unlocked! '+rewards.map(id=>accessoryCatalog.find(a=>a.id===id)?.name||id).join(' · '));return true}
 function identity(){return typeof arcadeAccounts==='undefined'?'guest':arcadeAccounts.identity()}
 function prepare(i){const g=games[i];session={game:['pitch','triad','rhythm'][i],origin:new URL(g.file,location.href).origin,token:crypto.randomUUID(),owner:identity()};$('cabinetstatus').textContent='Connecting achievements…'}
 function init(){if(!session)return;$('gameframe').contentWindow.postMessage({coda:1,type:'init',game:session.game,token:session.token},session.origin)}
 window.addEventListener('message',e=>{const m=e.data;if(!session||e.source!==$('gameframe').contentWindow||e.origin!==session.origin||!m||m.coda!==1||m.game!==session.game||$('gameview').hidden)return;if(m.type==='ready'){init();$('cabinetstatus').textContent='Achievements connected';return}if(m.type!=='result'||m.token!==session.token||typeof m.runId!=='string'||m.runId.length>100||identity()!==session.owner||identity()==='loading')return;if(apply(session.game,m.runId,m.result))$('cabinetstatus').textContent='Progress recorded ✓'});
 $('gameframe').addEventListener('load',init);
 definitions.forEach(([id,achievement,requirement])=>{const item=accessoryCatalog.find(a=>a.id===id);if(item)Object.assign(item,{achievement,requirement,planned:false,unlock:()=>unlocked(id)})});
 const bowtie=accessoryCatalog.find(a=>a.id==='bowtie');if(bowtie)bowtie.planned=false;
 for(const id of ['rainbowtrail','discohelmet']){const item=accessoryCatalog.find(a=>a.id===id);if(item)Object.assign(item,{planned:false,...(id==='discohelmet'?{requirement:'Earn every game-collection achievement, earn Full Ensemble, customize your avatar, and walk 450 steps.'}:{}),unlock:()=>unlocked(id)})}
 for(const item of [...shoeCatalog,...emoteCatalog]){const mapping={rocket:'racehelmet',moonwalk:'robothelmet',breakdance:'discohelmet'};if(mapping[item.id]){item.planned=false;item.unlock=()=>unlocked(mapping[item.id])}}
 const baseEarned=earned;earned=()=>[...baseEarned(),...definitions.map(d=>unlocked(d[0])),unlocked('rainbowtrail'),unlocked('discohelmet')];
 $('badges').onclick=()=>{show('<p class="eyebrow">YOUR MUSIC MILESTONES</p><h2>Achievements</h2><p>Complete rounds through the arcade cabinets to earn rewards. Guest progress stays on this browser; signed-in progress saves to your account.</p><div id="rewardlist"></div>');const local=[['Arcade sampler','Open all three cabinets.',data.visited.length===3],['Neon halo','Walk 450 steps.',data.walked>=450],['Bow tie','Customize and save your avatar.',data.customized===true],['Spin dance + star clip','Jump 10 times.',data.jumps>=10],['Robot dance + party glasses','Perform 5 emotes.',data.emotesUsed>=5],['Disco point + neon trainers','Walk 1,000 steps.',data.walked>=1000],['Gold kicks','Jump 25 times.',data.jumps>=25]];for(const [title,requirement,yes]of [...local,...definitions.map(d=>[d[1],d[2],unlocked(d[0])]),['Full Ensemble','Earn 3 game achievements in each game.',unlocked('rainbowtrail')],['Arcade Legend','Earn every game-collection achievement, earn Full Ensemble, customize your avatar, and walk 450 steps.',unlocked('discohelmet')]]){const row=document.createElement('div');row.className='reward';const strong=document.createElement('strong');strong.textContent=(yes?'◆ ':'🔒 ')+title;const small=document.createElement('small');small.textContent=requirement;row.append(strong,small);$('rewardlist').append(row)}};
 save();return{prepare,clean,apply,stats,unlocked,definitions};
})();
