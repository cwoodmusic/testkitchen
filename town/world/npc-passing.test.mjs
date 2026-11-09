import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planNPCPassing} from './npc-passing.mjs';
import {blank,blocked} from './model.mjs';
import {npcConnectionClear} from './npc-navigation.mjs';

const length=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
function sample(path,actor,check){let previous=actor;for(const end of path){assert(Math.abs(end.x-previous.x)<1e-6||Math.abs(end.y-previous.y)<1e-6,'Bypass must contain actual orthogonal movement');const n=Math.max(1,Math.ceil(length(previous,end)/2));for(let i=0;i<=n;i++)check({x:previous.x+(end.x-previous.x)*i/n,y:previous.y+(end.y-previous.y)*i/n});previous=end;}}
const segmentWithin=inside=>(a,b)=>{let clear=true;sample([b],a,p=>{if(!inside(p))clear=false;});return clear;};

test('a pedestrian commits to going around a head-on walker in a narrow promenade',()=>{
 const actor={id:'clara',x:100,y:96},obstacle={id:'bach',x:166,y:96},path=[{x:500,y:96}],inside=p=>p.x>=0&&p.x<=600&&p.y>=0&&p.y<=192;
 const result=planNPCPassing({actor,path,obstacle,others:[actor,obstacle],inside,connectionClear:segmentWithin(inside)});
 assert(result);assert(result.path.some(p=>p.y>=160));assert.deepEqual(result.path.at(-1),path[0]);
 sample(result.path,actor,p=>{assert(inside(p));assert(length(p,obstacle)>=56-1e-6);});
 assert(result.rejoin.x>obstacle.x+56);assert(result.bypassCount>=3);
});

test('passing goes beyond a shared corner rather than returning to its occupied waypoint',()=>{
 const actor={id:'nina',x:100,y:100},obstacle={id:'miles',x:160,y:100},path=[{x:160,y:100},{x:160,y:350},{x:500,y:350}],inside=p=>p.x>=0&&p.x<=600&&p.y>=0&&p.y<=450;
 const result=planNPCPassing({actor,path,obstacle,others:[obstacle],inside,connectionClear:segmentWithin(inside)});
 assert(result);assert(result.consumedWaypoints>=1);assert(result.rejoin.y>100+56);assert.deepEqual(result.path.at(-1),path.at(-1));
 sample(result.path,actor,p=>assert(length(p,obstacle)>=56-1e-6));
});

test('a blocked preferred side selects the other side without crossing a flowerbed',()=>{
 const actor={id:'ella',x:100,y:100},obstacle={id:'haydn',x:170,y:100},path=[{x:500,y:100}],inside=p=>p.x>=0&&p.x<=600&&p.y>=0&&p.y<=192;
 const flowers=p=>p.x>=80&&p.x<=300&&p.y>=125;
 const clear=p=>inside(p)&&!flowers(p),result=planNPCPassing({actor,path,obstacle,inside,connectionClear:segmentWithin(clear)});
 assert(result);assert.equal(result.side,-1);sample(result.path,actor,p=>assert(clear(p)));
});

test('an occupied destination does not become a route through its occupant',()=>{
 const actor={id:'joplin',x:100,y:100},obstacle={id:'chopin',x:200,y:100};
 assert.equal(planNPCPassing({actor,path:[{x:220,y:100}],obstacle,connectionClear:()=>true}),null);
 assert.equal(planNPCPassing({actor,path:[{x:600,y:100}],obstacle,others:[{id:'vendor',x:600,y:100}],connectionClear:()=>true}),null);
});

test('nearby pedestrians constrain the bypass and every input stays unchanged',()=>{
 const actor={id:'mozart',x:100,y:100},obstacle={id:'bach',x:166,y:100},others=[obstacle,{id:'vendor',x:140,y:170}],path=[{x:500,y:100}],before=JSON.stringify({actor,obstacle,others,path});
 const inside=p=>p.x>=0&&p.x<=600&&p.y>=0&&p.y<=240,result=planNPCPassing({actor,path,obstacle,others,inside,connectionClear:segmentWithin(inside)});
 assert(result);assert.equal(result.side,-1);
 sample(result.path,actor,p=>{for(const other of others)assert(length(p,other)>=56-1e-6);});
 assert.equal(JSON.stringify({actor,obstacle,others,path}),before);
});

test('a walker can first leave existing personal space without getting closer',()=>{
 const actor={id:'clara',x:100,y:100},obstacle={id:'bach',x:145,y:100},path=[{x:500,y:100}],inside=p=>p.x>=0&&p.x<=600&&p.y>=0&&p.y<=240;
 const result=planNPCPassing({actor,path,obstacle,inside,connectionClear:segmentWithin(inside)});assert(result);
 let before=length(actor,obstacle);sample([result.bypassWaypoints[0]],actor,p=>{const next=length(p,obstacle);assert(next+1e-6>=before);before=next;});
});

test('no passing path is returned when both sides are too narrow',()=>{
 const actor={x:100,y:40},obstacle={x:166,y:40},inside=p=>p.x>=0&&p.x<=600&&p.y>=0&&p.y<=80;
 assert.equal(planNPCPassing({actor,path:[{x:500,y:40}],obstacle,inside,connectionClear:segmentWithin(inside)}),null);
});

test('a walker against an edge first retreats into a safe passing pocket',()=>{
 const actor={id:'yielding',x:181,y:37},obstacle={id:'oncoming',x:150,y:64},others=[obstacle,{id:'next-person',x:221,y:78}],path=[{x:0,y:64}],inside=p=>p.x>=0&&p.x<=600&&p.y>=14&&p.y<=178;
 const result=planNPCPassing({actor,path,obstacle,others,inside,connectionClear:segmentWithin(inside),clearance:40});
 assert(result);assert(result.retreat>0,'Pinned walker needs a backwards pocket before going sideways');assert(result.path[0].x>actor.x);
 sample(result.path,actor,p=>{assert(inside(p));for(const other of others)assert(length(p,other)>=40-1e-6);});
 assert.deepEqual(result.path.slice(0,result.bypassCount),result.bypassWaypoints);
});

test('an offset pedestrian leaves a crowded bench approach through the available narrow pocket',()=>{
 // Exact benches, lamp and pedestrian positions from the authored arcade
 // frontage. A full64px detour hits the lamp; the free strip is only24px deep.
 const doc=blank(),catalog=new Map([
  ['bench',{w:160,h:87,boxes:[{x:6.4,y:46.98,w:147.2,h:38.28}]}],
  ['lamp',{w:90,h:192,boxes:[{x:14.4,y:145.92,w:61.2,h:42.24}]}]
 ]);
 for(const[id,asset,x,y]of [['bench-left','bench',10449.289232665113,6786.862201235002],['bench-right','bench',10604.977314438502,6786.862201235002],['lamp','lamp',10717.757128185545,6970.583183045175]])doc.objects.push({id,asset,x,y,scale:1,rotation:0,collision:true});
 const actor={id:'dj',x:10592,y:6880},obstacle={id:'handel',x:10604.977314438502,y:6842.862201235002};
 const path=[{x:12640,y:6880},{x:12627.30097304233,y:6880},{x:12627.30097304233,y:6870.5050917493545}],before=JSON.stringify({doc,actor,obstacle,path});
 const connectionClear=(a,b)=>npcConnectionClear(doc,catalog,a,b),result=planNPCPassing({actor,path,obstacle,connectionClear,clearance:52});
 assert(result,'A nearby lamp must not force an unnecessarily wide passing lane');
 assert(result.offset<=24&&result.offset>=16);assert.equal(result.retreat,0);assert.deepEqual(result.path.at(-1),path.at(-1));
 assert(!connectionClear({x:actor.x,y:actor.y+64},{x:actor.x+120,y:actor.y+64}),'The original wide route intersects the real lamp footprint');
 let previousDistance=length(actor,obstacle);
 sample([result.bypassWaypoints[0]],actor,p=>{const d=length(p,obstacle);assert(d+1e-6>=previousDistance,'An initial overlap must only get farther apart');previousDistance=d;});
 sample(result.path.slice(1),result.path[0],p=>assert(length(p,obstacle)>=52-1e-6));
 sample(result.path,actor,p=>assert.equal(blocked(doc,p.x,p.y,catalog),false));
 for(let i=0;i<result.bypassWaypoints.length;i++)assert(connectionClear(i?result.bypassWaypoints[i-1]:actor,result.bypassWaypoints[i]));
 assert.equal(JSON.stringify({doc,actor,obstacle,path}),before);
});
