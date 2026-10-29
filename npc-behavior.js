/* Original, imagined arcade conversations inspired by musical history.
 * The state machine shares the game's navigation map; it never bypasses walls. */
(function () {
  'use strict';
  const PROFILES = [
    {id:'bach',name:'J. S. Bach',description:'Baroque composer and keyboard player, known for counterpoint: independent melodies sounding together.',favorite:1,speed:65,sequence:['cabinet','lounge','wander','dance'],greetings:['A room full of independent musical ideas. Let us see how they fit together.','Every voice has something to contribute, even in an arcade.'],music:'In counterpoint, each melody has its own shape while listening to the others. Try following one line at a time.',advice:'Build a short melody, then answer it with another. Keep both lines singable.',games:'Music Triad has caught my attention. Relationships between notes can make a lovely puzzle.'},
    {id:'mozart',name:'Mozart',description:'Classical-era composer and pianist whose music includes operas, symphonies, concertos, and chamber works.',favorite:3,speed:78,sequence:['cabinet','dance','lounge','wander'],greetings:['Shall we turn a tiny musical idea into a grand adventure?','I have a new tune in mind. The difficult part is choosing just one!'],music:'A variation changes an idea while keeping something recognizable. Rhythm, register, and accompaniment all offer possibilities.',advice:'Write a small phrase, repeat it, and surprise yourself with a different ending.',games:'Song Machine looks like an excellent place to test a playful musical idea.'},
    {id:'beethoven',name:'Beethoven',description:'Composer and pianist whose symphonies, sonatas, and chamber music develop powerful ideas from small motifs.',favorite:0,speed:71,sequence:['cabinet','wander','lounge','dance'],greetings:['A small idea can carry a great deal of energy. What shall we try?','One more thoughtful attempt can reveal something new.'],music:'A motif is a short musical idea. Repeating, reshaping, and combining motifs can give a piece a strong identity.',advice:'Choose a short rhythm and see how many different musical phrases you can build from it.',games:'Pitch Race is good practice for recognizing notes. I prefer progress to a perfect first attempt.'},
    {id:'clara',name:'Clara Schumann',description:'Nineteenth-century pianist and composer celebrated for her performing career, piano works, songs, and chamber music.',favorite:3,speed:67,sequence:['lounge','cabinet','wander','dance'],greetings:['Hello. Have you found a phrase you would like to shape?','A little patient practice can make room for a beautiful performance.'],music:'Playing a phrase involves more than finding its notes: listen for where it grows, rests, and responds.',advice:'Practice a short passage slowly enough to hear every connection. Then give it a clear musical direction.',games:'I am interested in Song Machine. A melody can reveal a different character with a new accompaniment.'},
    {id:'joplin',name:'Scott Joplin',description:'Ragtime composer and pianist whose music pairs a steady accompaniment with syncopated melodies.',favorite:2,speed:73,sequence:['dance','cabinet','lounge','wander'],greetings:['A steady pulse makes a fine home for a lively melody.','Can you hear the little surprises between the beats?'],music:'Syncopation places accents where you may not expect them. In ragtime, a steady accompaniment helps those accents stand out.',advice:'Keep one hand tapping a regular beat while the other tries a rhythm between those beats.',games:'Rhythm Room is my next stop. A clear pulse matters more to me than rushing.'},
    {id:'ellington',name:'Duke Ellington',description:'Jazz composer, pianist, and bandleader who wrote for the distinctive sounds of his orchestra.',favorite:1,speed:64,sequence:['lounge','cabinet','dance','wander'],greetings:['This place could use an orchestra of its own. Which sound would you bring?','An interesting sound deserves a little room to be heard.'],music:'An arrangement gives musical ideas to particular instruments or voices. Their tone colors help tell the story.',advice:'Try giving the same melody to two different sounds. Listen to what changes before adding more notes.',games:'Music Triad offers some intriguing combinations. After that, I may try arranging a tune in Song Machine.'},
    {id:'ella',name:'Ella Fitzgerald',description:'Jazz singer renowned for her vocal agility, interpretation, and improvised scat singing.',favorite:2,speed:76,sequence:['dance','wander','cabinet','lounge'],greetings:['A little rhythm and a little imagination can start a whole conversation.','Would you like to trade a musical idea?'],music:'Scat singing uses invented syllables to improvise musical phrases. The voice can play with rhythm and melody like an instrument.',advice:'Sing a short phrase on any syllable, leave a pause, and answer it with a new phrase.',games:'Rhythm Room has a groove worth exploring. I might sing a little response while I wait.'},
    {id:'nina',name:'Nina Simone',description:'Classically trained pianist, singer, and arranger whose work crossed jazz, blues, folk, and soul.',favorite:3,speed:66,sequence:['wander','lounge','cabinet','dance'],greetings:['What would you like your music to say today?','Give a phrase some attention. Its meaning may surprise you.'],music:'An interpretation can transform a song through pacing, touch, harmony, and the space around a phrase.',advice:'Choose a feeling for your phrase. Change one musical detail and listen to whether that feeling becomes clearer.',games:'Song Machine gives an idea room to develop. I am listening for a melody with something to say.'},
    {id:'miles',name:'Miles Davis',description:'Jazz trumpeter and bandleader whose work explored changing approaches to improvisation, including modal jazz.',favorite:1,speed:62,sequence:['lounge','wander','cabinet','dance'],greetings:['There is plenty of sound in here. I am listening for an opening.','Try a phrase. Then give it a little space.'],music:'Modal jazz can build improvisation around a scale or mode. Kind of Blue, released in 1959, is a landmark example.',advice:'Play a few notes, pause, and listen. Let the next phrase answer what you just heard.',games:'I may stop by Music Triad. A small change in the notes can open a different direction.'},
    {id:'schoenberg',name:'Arnold Schoenberg',description:'Composer, teacher, and painter who explored atonality and developed a method of composing with twelve tones.',favorite:3,speed:66,sequence:['lounge','cabinet','wander','dance'],greetings:['A new sound can ask us to listen in a new way. Shall we explore?','You do not need to understand everything on your first hearing. Listen for one small idea.'],music:'A twelve-tone row puts the twelve pitch classes in a chosen order. A composer can transform that order to build musical relationships.',advice:'Try a short melody, then turn its direction upside down. What stays recognizable?',games:'Song Machine is a fine place to compare an idea with its transformation.'},
    {id:'handel',name:'George Frideric Handel',description:'Baroque composer and keyboard player celebrated for operas, orchestral music, and English-language oratorios.',favorite:2,speed:64,sequence:['cabinet','lounge','dance','wander'],greetings:['A melody can tell a story before a single word is sung.','Let us give this musical gathering a splendid opening!'],music:'An oratorio tells a story through solo singers, chorus, and instruments, usually without staged action. Messiah is one of my oratorios.',advice:'Make a short musical question, then answer it with a contrasting phrase.',games:'Rhythm Room offers a useful pulse for a grand procession. Then I may try a new tune in Song Machine.'},
    {id:'vivaldi',name:'Antonio Vivaldi',description:'Venetian Baroque composer, violinist, and teacher whose concertos often contrast soloists with an ensemble.',favorite:0,speed:75,sequence:['wander','cabinet','dance','lounge'],greetings:['Can you imagine a bird, a storm, or a dance in a few notes?','A small musical picture can grow into a whole concerto.'],music:'The Four Seasons is a set of four violin concertos. Its music suggests scenes such as birdsong, storms, and winter cold.',advice:'Choose a scene from nature. Try making its movement or mood with a short rhythm.',games:'Pitch Race keeps the notes moving. Song Machine lets us sketch a little musical scene.'}
  ];
  if(Array.isArray(window.CodaNPCVisitors?.profiles))PROFILES.push(...window.CodaNPCVisitors.profiles);
  const SEEDS=[[1150,365],[350,280],[1050,430],[250,300],[410,740],[550,735],[1340,650],[1340,725],[970,650]];
  const DESTINATIONS={
    lounge:[[225,250],[350,278],[260,316],[360,315]],
    dance:[[300,720],[405,744],[535,735],[650,745],[215,780],[585,790]],
    wander:[[1065,405],[1180,620],[1340,655],[1100,720],[925,450],[1435,665]]
  };
  const ACTIVITY={cabinet:'playing',lounge:'relaxing',dance:'dancing',wander:'waiting'};
  const ARRIVAL=12,PERSON_SPACE=23,PLAYER_SPACE=44,PLAYER_YIELD=50,PLAYER_GOAL_SPACE=PLAYER_YIELD+ARRIVAL;
  window.CodaMusicianCast=Object.freeze(PROFILES.map(profile=>Object.freeze({id:profile.id,name:profile.name,...(profile.unlockItem?{unlockItem:profile.unlockItem,appearance:profile.appearance,fictional:true}:{})})));
  window.CodaNPCDialogueDefaults=Object.freeze(Object.fromEntries(PROFILES.map(profile=>[profile.id,Object.freeze({
    description:profile.description,greetings:Object.freeze(profile.greetings.slice()),
    choices:Object.freeze([{id:'music',label:'Tell me about your music',reply:profile.music},{id:'activity',label:'What are you doing?',reply:''},{id:'advice',label:'Give me a musical tip',reply:profile.advice},{id:'games',label:'Which game do you like?',reply:profile.games}].map(Object.freeze))
  })])));

  window.createCodaNPCBehavior=function (api) {
    const npcs=api.npcs,states=new Map();
    let conversation=null,routeBudget=0,tick=0,elapsed=0,lastEntry=-Infinity,nextRotation=0;
    const rotation=api.rotation===true,limit=Math.max(1,Math.min(npcs.length||1,Number.isInteger(api.maxVisitors)?api.maxVisitors:6)),visitDuration=Math.max(1,Number.isFinite(api.visitDuration)?api.visitDuration:55),entryInterval=Math.max(.25,Number.isFinite(api.entryInterval)?api.entryInterval:3);
    const find=value=>typeof value==='object'?npcs.find(p=>p===value||p.id&&p.id===value?.id):npcs.find(p=>p.id===value||p.name===value);
    const profileFor=(p,index)=>PROFILES.find(profile=>profile.id===p.id||profile.name===p.name)||PROFILES[index%PROFILES.length];
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const player=()=>api.getPlayer?.()||{x:-9999,y:-9999};
    const anchored=p=>p.userPlaced||p.authoredPosition||p.pinned;
    function unlocked(p){const item=states.get(p)?.profile.unlockItem;if(!item)return true;try{return api.isUnlocked?.(item)===true;}catch{return false;}}
    function missionIds(){let missions=[];try{const value=api.getMissions?.();missions=Array.isArray(value)?value:Array.isArray(value?.missions)?value.missions:[];}catch{}return new Set(missions.filter(mission=>mission&&['active','complete'].includes(mission.status)).map(mission=>mission.person||mission.giver||mission.npcId).filter(Boolean));}
    function pinned(p,missions=missionIds()){if(states.get(p)?.chat||(states.get(p)?.recallUntil||0)>elapsed||p.conversation||p.pinned||p.userPlaced||p.authoredPosition||missions.has(p.id))return true;try{return api.isPinned?.(p)===true;}catch{return false;}}
    function dialogueFor(p){
      const profile=states.get(p).profile,base=window.CodaNPCDialogueDefaults[profile.id];let edited=null;
      try{edited=api.getDialogue?.(p.id);}catch{}
      if(!edited||typeof edited!=='object')return base;
      return {description:typeof edited.description==='string'?edited.description:base.description,
        greetings:Array.isArray(edited.greetings)&&edited.greetings.length?edited.greetings:base.greetings,
        choices:Array.isArray(edited.choices)?edited.choices:base.choices};
    }
    function facing(p,dx,dy){if(Math.hypot(dx,dy)<.01)return;p.facing=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';}
    function occupied(x,y,p,space=PERSON_SPACE,playerSpace=PLAYER_SPACE){
      const user=player();if(Math.hypot(x-user.x,y-user.y)<playerSpace)return true;
      return npcs.some(other=>other!==p&&!other.hidden&&Number.isFinite(other.x)&&Number.isFinite(other.y)&&Math.hypot(x-other.x,y-other.y)<space);
    }
    function safePoint(x,y,p,radius=60,avoidPeople=false){
      const safe=(xx,yy)=>api.inside(xx,yy)&&(!avoidPeople||!occupied(xx,yy,p));
      if(safe(x,y))return {x,y};
      for(let r=10;r<=radius;r+=10)for(let dy=-r;dy<=r;dy+=10)for(let dx=-r;dx<=r;dx+=10){if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;if(safe(x+dx,y+dy))return {x:x+dx,y:y+dy};}
      return null;
    }
    const duplicateStart=npcs.length>1&&npcs.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&distance(p,npcs[0])<1);
    npcs.forEach((p,index)=>{
      const profile=profileFor(p,index),state={profile,index,next:0,target:null,replanIn:index*.09,retries:0,blocked:0,chat:false,lastLine:'',greetings:0,wasActivity:'waiting',targetSerial:0,visitState:'visiting',visitRemaining:visitDuration*(1+(index%5)*.1),outsideSince:0,departureAge:0,unlocked:false,invitation:false,recallUntil:0,avoidSide:1};states.set(p,state);
      p.id=p.id||profile.id;p.name=profile.name;if(profile.appearance)p.appearance={...profile.appearance,...(p.appearance||{})};p.visitorOpacity=1;p.personality=profile.description;p.facing=p.facing||'down';p.walking=false;p.conversation=false;p.phase=Number.isFinite(p.phase)?p.phase:0;
      p.route=[];p.routeKey='';p.arrived=false;p.mode='wander';p.activity='waiting';p.wait=0;p.goal=profile.favorite;
      const [sx,sy]=SEEDS[index%SEEDS.length],hasPosition=Number.isFinite(p.x)&&Number.isFinite(p.y),initial=anchored(p)&&hasPosition?p:duplicateStart||!hasPosition?{x:sx,y:sy}:p;
      const point=anchored(p)?api.inside(initial.x,initial.y)?{x:initial.x,y:initial.y}:null:safePoint(initial.x,initial.y,p,100,true)||safePoint(sx,sy,p,150,true);
      if(point){p.x=point.x;p.y=point.y;p.hidden=false;}else{p.hidden=true;state.replanIn=2;}
    });

    if(rotation){
      const missions=missionIds(),eligible=npcs.filter(unlocked),raw=typeof api.random==='function'?api.random():Math.random(),roll=Number.isFinite(raw)?Math.max(0,Math.min(.999999,raw)):0,offset=Math.floor(roll*Math.max(1,eligible.length)),ordered=eligible.slice(offset).concat(eligible.slice(0,offset)),protectedVisitors=eligible.filter(p=>pinned(p,missions)),selected=new Set([...new Set([...protectedVisitors,...ordered])].slice(0,limit));
      for(const p of npcs){const state=states.get(p);state.unlocked=unlocked(p);if(!selected.has(p)){p.hidden=true;state.visitState='outside';releaseTarget(p,0);}else if(p.hidden)state.visitState='recovering';}
      nextRotation=visitDuration;
    }
    function requestDeparture(p){
      const state=states.get(p),entry=entryPoint(p,state);if(!entry)return false;
      releaseTarget(p,0);state.visitState='leaving';state.departureAge=0;state.target={...entry,mode:'leave'};p.mode='leave';return true;
    }
    function leaveArcade(p){
      const state=states.get(p);p.hidden=true;p.visitorOpacity=1;releaseTarget(p,entryInterval);state.visitState='outside';state.outsideSince=elapsed;state.invitation=false;state.visitRemaining=visitDuration*(1+(state.index%5)*.1);state.departureAge=0;
    }
    function refreshVisitors(dt){
      if(!rotation)return;
      const missions=missionIds();
      for(const p of npcs){const state=states.get(p),allowed=unlocked(p);if(allowed&&!state.unlocked){state.invitation=true;state.outsideSince=-1000000-elapsed;}state.unlocked=allowed;
        if(!allowed){if(!p.hidden){if(state.chat)endConversation();p.hidden=true;releaseTarget(p,entryInterval);}state.visitState='outside';continue;}
        if(!p.hidden){
          if(state.visitState==='leaving'&&pinned(p,missions)){state.visitState='visiting';state.departureAge=0;p.visitorOpacity=1;releaseTarget(p,0);}
          // Departures keep their route until they reach the doorway. A slow or
          // blocked visitor must not vanish elsewhere to admit a replacement.
          if(state.visitState==='leaving')state.departureAge+=dt;
          else if(!pinned(p,missions))state.visitRemaining=Math.max(0,state.visitRemaining-dt);
        }
      }
      const eligible=npcs.filter(unlocked),desired=limit,onsite=eligible.filter(p=>!p.hidden),waiting=eligible.filter(p=>p.hidden&&states.get(p).replanIn<=0&&['outside','recovering'].includes(states.get(p).visitState)).sort((a,b)=>Number(pinned(b,missions))-Number(pinned(a,missions))||states.get(a).outsideSince-states.get(b).outsideSince||states.get(a).index-states.get(b).index);
      if(waiting.length&&onsite.length<desired&&elapsed-lastEntry>=entryInterval){const p=waiting[0],state=states.get(p),point=entryPoint(p,state);if(point){p.x=point.x;p.y=point.y;p.hidden=false;p.visitorOpacity=1;state.visitState='arriving';state.invitation=false;state.visitRemaining=visitDuration*(1+(state.index%5)*.1);releaseTarget(p,0);lastEntry=elapsed;}}
      const pending=waiting.length&&(waiting.some(p=>pinned(p,missions)||states.get(p).invitation)||elapsed>=nextRotation),leaving=onsite.some(p=>states.get(p).visitState==='leaving');
      if(!leaving&&(onsite.length>desired||pending&&onsite.length>=desired)){
        const candidates=onsite.filter(p=>!pinned(p,missions)&&states.get(p).visitState!=='arriving').sort((a,b)=>states.get(a).visitRemaining-states.get(b).visitRemaining||states.get(a).index-states.get(b).index),choice=candidates.find(p=>onsite.length>desired||waiting.some(other=>pinned(other,missions)||states.get(other).invitation)||states.get(p).visitRemaining<=0);
        if(choice&&requestDeparture(choice))nextRotation=elapsed+Math.max(2,visitDuration*.2);
      }
    }
    function games(){return (api.getGames?.()||[]).filter(g=>Number.isFinite(g.npcX??g.x)&&Number.isFinite(g.npcY??g.y));}
    function chooseTarget(p,available){
      const state=states.get(p),profile=state.profile;
      for(let attempt=0;attempt<profile.sequence.length+1;attempt++){
        const mode=profile.sequence[state.next++%profile.sequence.length];
        if(mode==='cabinet'){
          const candidates=available.slice().sort((a,b)=>(a.index===profile.favorite?-1:b.index===profile.favorite?1:0));
          for(const game of candidates){
            if(npcs.some(other=>other!==p&&states.get(other)?.target?.mode==='cabinet'&&states.get(other).target.gameIndex===game.index))continue;
            const point=safePoint(game.npcX??game.x,game.npcY??game.y,p,30);
            if(!point||occupied(point.x,point.y,p,PERSON_SPACE,PLAYER_GOAL_SPACE))continue;
            state.target={...point,mode,gameIndex:game.index,label:game.name};p.goal=game.index;break;
          }
        }else{
          const points=DESTINATIONS[mode];
          for(let j=0;j<points.length;j++){
            const raw=points[(state.index+state.targetSerial+j)%points.length],point=safePoint(raw[0],raw[1],p,40);
            if(!point||occupied(point.x,point.y,p,PERSON_SPACE,PLAYER_GOAL_SPACE))continue;
            if(npcs.some(other=>other!==p&&states.get(other)?.target&&distance(states.get(other).target,point)<PERSON_SPACE))continue;
            state.target={...point,mode};break;
          }
        }
        if(state.target){p.mode=state.target.mode;p.arrived=false;p.wait=0;p.route=[];p.routeKey='';state.targetSerial++;state.retries=0;state.blocked=0;return true;}
      }
      p.walking=false;p.activity='waiting';state.replanIn=1.5;return false;
    }
    function releaseTarget(p,delay=.2){const state=states.get(p);state.target=null;p.route=[];p.routeKey='';p.arrived=false;p.walking=false;p.activity='waiting';p.wait=0;state.replanIn=delay;}
    function despawnBlocked(p){
      const state=states.get(p);
      if(state.chat)endConversation();
      p.hidden=true;p.conversation=false;p.visitorOpacity=1;releaseTarget(p,.6+state.index*.03);if(rotation)state.visitState='recovering';state.retries=0;state.blocked=0;
    }
    function entryPoint(p,state){
      if(anchored(p))return api.inside(p.x,p.y)?{x:p.x,y:p.y}:null;
      if(rotation){let entry={x:1450,y:752};try{const value=api.getEntrance?.();if(Number.isFinite(value?.x)&&Number.isFinite(value?.y))entry=value;}catch{}return safePoint(entry.x,entry.y,p,60,true);}
      const seeds=[SEEDS[state.index%SEEDS.length],[1450,752],...SEEDS];
      for(const [x,y]of seeds){const point=safePoint(x,y,p,100,true);if(point)return point;}
      return null;
    }
    function arrive(p){
      const state=states.get(p);if(rotation&&state.visitState==='leaving'){leaveArcade(p);return;}if(rotation&&state.visitState==='arriving')state.visitState='visiting';p.route=[];p.arrived=true;p.walking=false;p.activity=ACTIVITY[p.mode]||'waiting';state.blocked=0;
      p.wait=p.mode==='cabinet'?7+state.index%4:p.mode==='lounge'?8+state.index%5:p.mode==='dance'?9+state.index%5:2+state.index%3;
      if(p.mode==='cabinet')p.facing='up';else if(p.mode==='dance')p.facing='down';
    }
    function failedRoute(p){
      const state=states.get(p);p.route=[];p.routeKey='';p.walking=false;p.activity='waiting';state.retries++;state.replanIn=.7+state.index*.12;
      if(state.retries>=2&&!(rotation&&state.visitState==='leaving'))releaseTarget(p,1+state.index*.1);
    }
    function refreshCabinet(p,available){
      const state=states.get(p),target=state.target;if(target?.mode!=='cabinet')return;
      const game=available.find(g=>g.index===target.gameIndex);
      if(!game){releaseTarget(p,.1);return;}
      const desired={x:game.npcX??game.x,y:game.npcY??game.y};
      if(distance(target,desired)>6){
        const point=safePoint(desired.x,desired.y,p,30);if(!point){releaseTarget(p,.5);return;}
        state.target={...target,...point,label:game.name};p.route=[];p.routeKey='';p.arrived=false;p.wait=0;state.replanIn=Math.min(state.replanIn,.25);state.retries=0;
      }
    }
    function tryStep(p,dx,dy){
      const x=p.x+dx,y=p.y+dy;
      if(!api.inside(x,y))return false;
      // The player can walk onto a visitor. In that case rejecting every
      // substep inside the radius traps the visitor permanently. Permit an
      // escape which increases existing separation, never a deeper overlap.
      const clear=(other,space)=>{const before=distance(p,other),after=Math.hypot(x-other.x,y-other.y);return after>=space||before<space&&after>before+.0001;};
      if(!clear(player(),PLAYER_SPACE)||npcs.some(other=>other!==p&&!other.hidden&&!clear(other,PERSON_SPACE)))return false;
      p.x=x;p.y=y;return true;
    }
    function avoidStep(p,dx,dy,amount){
      const state=states.get(p),dist=Math.hypot(dx,dy);if(dist<.001)return false;
      const nx=dx/dist,ny=dy/dist;
      // A consistent passing side lets two approaching visitors separate.
      // Keep that side through the encounter rather than oscillating around
      // the same blocked waypoint on alternate frames.
      for(const side of [state.avoidSide,-state.avoidSide]){
        for(const angle of [Math.PI/2,Math.PI/4,Math.PI*3/4]){
          const turn=angle*side,c=Math.cos(turn),s=Math.sin(turn);
          if(tryStep(p,(nx*c-ny*s)*amount,(nx*s+ny*c)*amount)){state.avoidSide=side;return true;}
        }
      }
      return false;
    }
    function givePlayerSpace(p,dt){
      const user=player(),away=distance(p,user),state=states.get(p);
      if(away>=PLAYER_YIELD-.05){state.yielding=false;return false;}
      if(away>=PLAYER_SPACE&&!p.arrived&&!state.yielding)return false;
      state.yielding=true;
      const angle=state.index*2.399963229728653,dx=away>.001?p.x-user.x:Math.cos(angle),dy=away>.001?p.y-user.y:Math.sin(angle),length=Math.hypot(dx,dy),step=Math.min(state.profile.speed*dt,PLAYER_YIELD-away),parts=Math.max(1,Math.ceil(step/3)),before={x:p.x,y:p.y};
      if(p.arrived)releaseTarget(p,.25+state.index*.02);
      for(let part=0;part<parts;part++){
        if(tryStep(p,dx/length*step/parts,dy/length*step/parts))continue;
        if(!avoidStep(p,dx,dy,step/parts))break;
      }
      const moved=distance(before,p);p.walking=moved>.01;p.activity=p.walking?'walking':'waiting';
      if(p.walking){facing(p,dx,dy);p.phase+=moved/7;p.walked=(p.walked||0)+moved;}
      return true;
    }
    function walk(p,dt){
      const state=states.get(p),target=state.target;
      if(distance(p,target)<=ARRIVAL){arrive(p);return;}
      if(!p.route.length){
        if(state.replanIn>0||routeBudget<=0)return;
        routeBudget--;
        const route=api.route(p.x,p.y,target.x,target.y);
        p.route=Array.isArray(route)?route.filter(point=>point&&Number.isFinite(point.x)&&Number.isFinite(point.y)).map(point=>({x:point.x,y:point.y})):[];
        p.routeKey=target.mode+':'+(target.gameIndex??'')+':'+target.x.toFixed(1)+':'+target.y.toFixed(1);
        if(!p.route.length){if(distance(p,target)<=ARRIVAL)arrive(p);else failedRoute(p);return;}
      }
      while(p.route.length&&distance(p,p.route[0])<1)p.route.shift();
      if(!p.route.length){if(distance(p,target)<=ARRIVAL)arrive(p);else failedRoute(p);return;}
      const point=p.route[0],dx=point.x-p.x,dy=point.y-p.y,dist=Math.hypot(dx,dy),step=Math.min(state.profile.speed*dt,dist),steps=Math.max(1,Math.ceil(step/3)),before={x:p.x,y:p.y};
      let wall=false,crowded=false;
      for(let i=0;i<steps;i++){
        const mx=dx/dist*step/steps,my=dy/dist*step/steps;
        if(tryStep(p,mx,my))continue;
        wall=!api.inside(p.x+mx,p.y+my);
        if(!wall){crowded=true;if(avoidStep(p,dx,dy,step/steps))continue;}
        break;
      }
      let moved=distance(before,p);
      if(moved<.01||crowded){
        state.blocked+=dt;
        if(wall||state.blocked>2.4){p.route=[];p.routeKey='';state.replanIn=.45+state.index*.09;state.blocked=0;state.retries++;if(state.retries>=3&&!(rotation&&state.visitState==='leaving'))releaseTarget(p,1);}
      }else state.blocked=0;
      p.walking=moved>.01;p.activity=p.walking?'walking':'waiting';
      // Brief avoidance steps should not flash a different facing before
      // immediately turning back. Keep looking along the intended route.
      if(p.walking){facing(p,dx,dy);p.phase+=moved/7;p.walked=(p.walked||0)+moved;}
      if(p.route.length&&distance(p,p.route[0])<1)p.route.shift();
      if(distance(p,target)<=ARRIVAL)arrive(p);
    }
    function update(dt){
      if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.25);routeBudget=2;tick++;elapsed+=dt;
      for(const state of states.values())state.replanIn=Math.max(0,state.replanIn-dt);refreshVisitors(dt);
      const available=games(),start=tick%npcs.length;
      for(let i=0;i<npcs.length;i++){
        const p=npcs[(start+i)%npcs.length],state=states.get(p);p.walking=false;
        if(!p.hidden&&!api.inside(p.x,p.y)){despawnBlocked(p);continue;}
        if(p.hidden){if(rotation)continue;if(!state.replanIn){const point=entryPoint(p,state);if(point){p.x=point.x;p.y=point.y;p.hidden=false;}else state.replanIn=2;}continue;}
        if(state.chat){p.activity='chatting';const user=player();facing(p,user.x-p.x,user.y-p.y);continue;}
        if(anchored(p)){p.route=[];p.activity='waiting';continue;}
        if(givePlayerSpace(p,dt))continue;
        refreshCabinet(p,available);
        if(state.target&&state.target.mode!=='leave'&&distance(state.target,player())<PLAYER_GOAL_SPACE)releaseTarget(p,.15);
        if(state.target&&p.arrived){
          if(!api.inside(p.x,p.y)){releaseTarget(p,.5);continue;}
          p.wait=Math.max(0,p.wait-dt);p.activity=ACTIVITY[p.mode]||'waiting';if(p.wait>0)continue;releaseTarget(p,0);
        }
        if(!state.target){if(state.replanIn>0)continue;if(!chooseTarget(p,available))continue;}
        walk(p,dt);
      }
    }

    function getConversation(value){
      const p=find(value);if(!p)return null;const state=states.get(p),dialogue=dialogueFor(p);
      return {id:p.id,name:p.name,description:dialogue.description,activity:p.activity,fictional:true,original:!!state.profile.unlockItem,line:state.lastLine||dialogue.greetings[0],choices:dialogue.choices.map(choice=>({id:choice.id,label:choice.label}))};
    }
    function say(value,topic='greeting'){
      const p=find(value);if(!p)return '';const state=states.get(p),dialogue=dialogueFor(p),profile={...state.profile};
      for(const choice of dialogue.choices)if(['music','advice','games'].includes(choice.id))profile[choice.id]=choice.reply;
      const selected=dialogue.choices.find(choice=>choice.id===topic);
      if(topic==='greeting')state.lastLine=dialogue.greetings[state.greetings++%dialogue.greetings.length];
      else if(selected?.reply)state.lastLine=selected.reply;
      else if(topic==='activity'){
        const activity=state.chat?state.wasActivity:p.activity;
        state.lastLine=activity==='playing'?'I am exploring '+(state.target?.label||'an arcade game')+'. '+profile.games:activity==='dancing'?'I am trying out a rhythm on the dance floor. '+profile.advice:activity==='relaxing'?'I am taking a moment in the lounge to listen and think. '+profile.music:state.target?.mode==='cabinet'?'I am on my way to '+state.target.label+'. '+profile.games:'I am exploring the arcade and listening for a new idea. '+profile.advice;
      }else state.lastLine=profile[topic]||profile.advice;
      return state.lastLine;
    }
    function endConversation(){
      if(!conversation)return;const p=conversation,state=states.get(p);state.chat=false;p.conversation=false;p.activity=p.arrived?(ACTIVITY[p.mode]||'waiting'):'waiting';p.walking=false;conversation=null;
    }
    function beginConversation(value){
      const p=find(value);if(!p||p.hidden)return null;if(conversation&&conversation!==p)endConversation();
      const state=states.get(p);if(!state.chat)state.wasActivity=p.activity;state.chat=true;p.conversation=true;conversation=p;p.walking=false;p.activity='chatting';const user=player();facing(p,user.x-p.x,user.y-p.y);say(p);return getConversation(p);
    }
    function invalidateRoutes(){
      for(const p of npcs){const state=states.get(p);if(!p.hidden&&!api.inside(p.x,p.y)){despawnBlocked(p);continue;}p.route=[];p.routeKey='';p.walking=false;if(!p.hidden)state.replanIn=state.index*.05;state.blocked=0;state.retries=0;if(p.arrived&&state.target){p.arrived=false;p.wait=0;p.activity=state.chat?'chatting':'waiting';}}
    }
    function requestVisit(value){
      const p=find(value);if(!p||!unlocked(p))return false;const state=states.get(p);state.recallUntil=elapsed+90;
      if(p.hidden){state.replanIn=0;state.outsideSince=-1000000-elapsed;state.invitation=true;}
      else if(state.visitState==='leaving'){state.visitState='visiting';state.departureAge=0;p.visitorOpacity=1;releaseTarget(p,0);}
      return true;
    }
    function snapshot(){return npcs.map(p=>{const state=states.get(p);return {id:p.id,name:p.name,description:dialogueFor(p).description,x:p.x,y:p.y,facing:p.facing,walking:p.walking,phase:p.phase,activity:p.activity,mode:p.mode,arrived:p.arrived,hidden:p.hidden,wait:p.wait,conversation:state.chat,target:state.target?{...state.target}:null,routeLength:p.route.length,visitState:state.visitState,visitRemaining:state.visitRemaining,unlockItem:state.profile.unlockItem||null,unlocked:unlocked(p),visitorOpacity:p.visitorOpacity??1};});}
    return {update,beginConversation,endConversation,say,getConversation,invalidateRoutes,requestVisit,snapshot,getVisitorState:()=>({enabled:rotation,limit,elapsed,onsite:npcs.filter(p=>!p.hidden).map(p=>p.id),waiting:npcs.filter(p=>p.hidden&&unlocked(p)).map(p=>p.id),locked:npcs.filter(p=>!unlocked(p)).map(p=>p.id)})};
  };
})();
