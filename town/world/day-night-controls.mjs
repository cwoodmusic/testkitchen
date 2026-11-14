/** One time-of-day selector shared by Builder and Play. */
export function mountDayNightControl(cycle,{parent,replace,onChange=()=>{}}={}){
 const element=document.createElement('select');element.id='lightingToggle';element.className='town-time-control';element.setAttribute('aria-label','Time of day');
 const labels=[['auto','Auto · Day'],['day','Daylight'],['dusk','Dusk'],['night','City night'],['dawn','Dawn']],options=new Map();
 for(const[value,label]of labels){const option=document.createElement('option');option.value=value;option.textContent=label;element.append(option);options.set(value,option);}
 element.title='Automatic cycle: day 10 minutes, dusk 3 minutes, night 5 minutes, dawn 3 minutes. Choose a fixed time to preview it.';
 function update(state=cycle.sample()){
  const label='Auto · '+(state.mode==='auto'?state.label:({day:'Day',dusk:'Dusk',night:'Night',dawn:'Dawn'}[state.timelinePhase]||'Day'));
  if(options.get('auto').textContent!==label)options.get('auto').textContent=label;
  if(element.value!==state.mode)element.value=state.mode;
  if(element.dataset.phase!==state.phase)element.dataset.phase=state.phase;
  return state;
 }
 element.addEventListener('change',()=>{cycle.setMode(element.value);update();onChange();});
 if(replace)replace.replaceWith(element);else parent?.append(element);
 update();return {element,update};
}
