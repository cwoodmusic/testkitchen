/** The opening story is presentation only; it never reads or writes a save. */
export const STORY_INTRO_PARAGRAPHS=Object.freeze([
 'Lumen Reach’s public bell fell silent. It once kept the doors, postal routes, water clocks, and mechanical courier birds working together. Now signals go out, but replies don’t return. Everyday life has started getting stuck.',
 'Then a parcel returns to Nell’s depot with its wax seal still warm—even though the outgoing routes are dark. Something carried it back, and nobody knows how.',
 'Nell gathers Mira, Iris, and Pip to follow that mystery through the old network. They’re trying to discover who—or what—is still answering, and why the bell stopped.',
]);

/** A comfortable reading duration, independent of wrapping or screen size. */
export function storyIntroDurationMs(paragraphs=STORY_INTRO_PARAGRAPHS){
 const words=paragraphs.join(' ').trim().split(/\s+/u).filter(Boolean).length;
 return Math.max(40000,Math.min(60000,Math.round(words/145*60000+3000)));
}

/** A deterministic clock. Background pauses cannot turn into a catch-up jump. */
export function createStoryIntroClock({duration=storyIntroDurationMs()}={}){
 if(!Number.isFinite(duration)||duration<=0)throw new TypeError('The story needs a positive duration.');
 let elapsed=0,playing=true,finished=false,skipped=false,cached=null;
 const dirty=()=>{cached=null;};
 function pause(){if(!playing)return false;playing=false;dirty();return true;}
 function play(){if(playing||finished)return false;playing=true;dirty();return true;}
 function finish(skip=false){if(finished)return false;elapsed=duration;finished=true;skipped=!!skip;playing=false;dirty();return true;}
 function update(delta){
  if(!playing||finished||!Number.isFinite(delta)||delta<=0)return false;
  elapsed=Math.min(duration,elapsed+Math.min(100,delta));
  if(elapsed>=duration){finished=true;playing=false;}dirty();return true;
 }
 return Object.freeze({update,pause,play,finish,skip:()=>finish(true),get state(){return cached??=Object.freeze({elapsed,duration,progress:elapsed/duration,playing,finished,skipped});}});
}

/** An opaque, flat vertical story crawl before the room entrance. */
export function createStoryIntro({root,onFinish=()=>{}}={}){
 if(!root?.ownerDocument)throw new TypeError('The story intro needs a root element.');
 const document=root.ownerDocument,window=document.defaultView;
 const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
 const clock=createStoryIntroClock();clock.pause();
 const element=document.createElement('section');element.id='story-intro';element.className='story-intro';element.dataset.reducedMotion=String(reducedMotion);
 element.setAttribute('role','dialog');element.setAttribute('aria-modal','true');element.setAttribute('aria-labelledby','story-intro-title');
 const header=document.createElement('header');header.className='story-intro-heading';
 const title=document.createElement('h1');title.id='story-intro-title';title.textContent='The Quiet Bell';header.append(title);
 const viewport=document.createElement('div');viewport.id='story-intro-window';viewport.className='story-intro-window';viewport.setAttribute('aria-label','Opening story');if(reducedMotion)viewport.tabIndex=0;
 const copy=document.createElement('article');copy.id='story-intro-copy';copy.className='story-intro-text';
 for(const text of STORY_INTRO_PARAGRAPHS){const paragraph=document.createElement('p');paragraph.textContent=text;copy.append(paragraph);}
 viewport.append(copy);
 const footer=document.createElement('footer');footer.className='story-intro-controls';
 const begin=document.createElement('button');begin.type='button';begin.id='story-intro-continue';begin.className='mg-button';begin.textContent='Begin the journey';begin.hidden=!reducedMotion;
 const skip=document.createElement('button');skip.type='button';skip.id='story-intro-skip';skip.className='mg-button';skip.textContent='Skip intro · Esc';skip.setAttribute('aria-keyshortcuts','Escape');
 footer.append(begin,skip);element.append(header,viewport,footer);
 const previousFocus=document.activeElement,wasIntro=root.classList.contains('story-intro-playing');
 const inertChildren=[...root.children].map(child=>[child,child.inert]);for(const [child]of inertChildren)child.inert=true;
 root.classList.add('story-intro-playing');root.append(element);
 let disposed=false,notified=false,ready=false,frame=0,last=0,scrollY=0,distance=0,startY=0,wantsPlay=!reducedMotion,resumeAfterHidden=false,backgrounded=document.hidden;
 const removers=[];
 function listen(target,type,handler,options){target.addEventListener(type,handler,options);removers.push(()=>target.removeEventListener(type,handler,options));}
 function state(){return Object.freeze({...clock.state,ready,reducedMotion,scrollY,distance});}
 function paint(){
  if(disposed||reducedMotion)return;
  scrollY=startY-distance*clock.state.progress;copy.style.transform=`translate3d(0,${scrollY}px,0)`;
 }
 function layout(){
  if(disposed)return;
  startY=viewport.clientHeight;distance=startY+copy.scrollHeight;paint();
 }
 function schedule(){if(!disposed&&!frame&&ready&&clock.state.playing&&!document.hidden&&!backgrounded)frame=window.requestAnimationFrame(tick);}
 function tick(now){
  frame=0;if(disposed)return;
  const delta=last?Math.max(0,Math.min(80,now-last)):16;last=now;clock.update(delta);paint();
  if(clock.state.finished)complete(false);else schedule();
 }
 function cancelFrame(){if(frame)window.cancelAnimationFrame(frame);frame=0;last=0;}
 function pause(){wantsPlay=false;cancelFrame();return clock.pause();}
 function play(){
  if(disposed||reducedMotion||clock.state.finished)return false;
  wantsPlay=true;if(!ready||document.hidden||backgrounded)return false;
  const changed=clock.play();last=0;schedule();return changed;
 }
 function destroy(){
  if(disposed)return;disposed=true;cancelFrame();clock.pause();for(const remove of removers)remove();observer?.disconnect();element.remove();
  for(const [child,inert]of inertChildren)if(child.isConnected)child.inert=inert;
  if(!wasIntro)root.classList.remove('story-intro-playing');
  if(previousFocus?.isConnected&&typeof previousFocus.focus==='function')previousFocus.focus({preventScroll:true});
 }
 function complete(skipped){
  if(disposed||notified)return;notified=true;clock.finish(skipped);const final=state();destroy();onFinish({skipped:!!skipped,state:final});
 }
 function skipIntro(){complete(true);}
 listen(skip,'click',event=>{event.stopPropagation();skipIntro();});
 listen(begin,'click',event=>{event.stopPropagation();complete(false);});
 listen(document,'keydown',event=>{
  if(disposed)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)skipIntro();return;}
  if(event.key==='Tab'){
   const stops=[...(reducedMotion?[viewport]:[]),begin,skip].filter(node=>!node.hidden),index=stops.indexOf(document.activeElement);
   if(event.shiftKey&&index<=0||!event.shiftKey&&(index<0||index===stops.length-1)){event.preventDefault();stops[event.shiftKey?stops.length-1:0].focus({preventScroll:true});}
   event.stopPropagation();return;
  }
  if(reducedMotion&&viewport.contains(event.target)&&['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)){
   event.preventDefault();event.stopPropagation();
   const page=viewport.clientHeight*.85,step=event.key==='ArrowUp'?-48:event.key==='ArrowDown'?48:event.key==='PageUp'||event.key===' '&&event.shiftKey?-page:page;
   viewport.scrollTop=event.key==='Home'?0:event.key==='End'?viewport.scrollHeight:viewport.scrollTop+step;return;
  }
  // Buttons retain native Enter/Space activation. Other game shortcuts cannot
  // open inventory, the director, or the next scene beneath the introduction.
  event.stopPropagation();
  if(!event.target.closest('#story-intro button'))event.preventDefault();
 },{capture:true});
 function background(){if(disposed)return;backgrounded=true;resumeAfterHidden=resumeAfterHidden||clock.state.playing;cancelFrame();clock.pause();}
 function foreground(){if(disposed||document.hidden)return;backgrounded=false;const resume=resumeAfterHidden||ready&&wantsPlay;resumeAfterHidden=false;if(resume&&wantsPlay)play();}
 listen(window,'blur',background);listen(window,'focus',foreground);listen(document,'visibilitychange',()=>{if(document.hidden)background();else foreground();});
 let observer=null;
 if(window.ResizeObserver){observer=new window.ResizeObserver(layout);observer.observe(viewport);observer.observe(copy);}
 else listen(window,'resize',layout);
 const fontReady=document.fonts?.load?.('32px QuietBellIntro');
 Promise.resolve(fontReady).catch(()=>{}).then(()=>{
  if(disposed)return;ready=true;layout();if(wantsPlay&&!document.hidden)play();
 });
 layout();(reducedMotion?begin:skip).focus({preventScroll:true});
 return Object.freeze({get state(){return state();},pause,play,skip:skipIntro,destroy});
}
