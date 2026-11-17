const SVG_NS='http://www.w3.org/2000/svg';
const CARD_WIDTH=82,COLUMN_GAP=12,ROW_GAP=50,PADDING=8;

function svgElement(document,name,attributes={}){
  const element=document.createElementNS(SVG_NS,name);
  for(const [key,value] of Object.entries(attributes))element.setAttribute(key,String(value));
  return element;
}

function titleLines(title){
  const lines=[];
  let line='';
  for(const word of title.trim().split(/\s+/)){
    if(line&&(line.length+word.length+1)>10){lines.push(line);line='';}
    let remainder=word;
    while(remainder.length>10){
      if(line){lines.push(line);line='';}
      lines.push(remainder.slice(0,10));remainder=remainder.slice(10);
    }
    line=line?`${line} ${remainder}`:remainder;
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
}

/** Derive the layout exclusively from places and connections already discovered. */
function observedLayout(nodes,edges){
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const outgoing=new Map(nodes.map(node=>[node.id,[]]));
  const incoming=new Map(nodes.map(node=>[node.id,0]));
  const rank=new Map(nodes.map(node=>[node.id,0]));
  for(const edge of edges){
    outgoing.get(edge.from).push(edge.to);
    incoming.set(edge.to,incoming.get(edge.to)+1);
  }
  const queue=nodes.filter(node=>incoming.get(node.id)===0).map(node=>node.id);
  const ordered=[];
  for(let index=0;index<queue.length;index++){
    const id=queue[index];ordered.push(id);
    for(const next of outgoing.get(id)){
      rank.set(next,Math.max(rank.get(next),rank.get(id)+1));
      incoming.set(next,incoming.get(next)-1);
      if(incoming.get(next)===0)queue.push(next);
    }
  }
  // Authored rooms form a DAG. Keep any observed cyclic component visible too.
  const placed=new Set(ordered);
  for(const node of nodes)if(!placed.has(node.id)){rank.set(node.id,0);ordered.push(node.id);}
  const rows=[];
  for(const id of ordered){
    const row=rank.get(id);
    (rows[row]??=[]).push(byId.get(id));
  }
  const columns=Math.max(...rows.map(row=>row.length));
  const width=Math.max(194,columns*CARD_WIDTH+(columns-1)*COLUMN_GAP+PADDING*2);
  // Returning trails need room above and below their cards. Keep the opening's
  // compact width while ensuring a cycle or self-loop stays inside the SVG.
  const verticalPadding=PADDING+(edges.some(edge=>rank.get(edge.to)!==rank.get(edge.from)+1)?16:0);
  const lineCount=Math.max(...nodes.map(node=>titleLines(node.title).length));
  const cardHeight=Math.max(72,lineCount*16+40);
  const positions=new Map();
  rows.forEach((row,rowIndex)=>{
    const rowWidth=row.length*CARD_WIDTH+(row.length-1)*COLUMN_GAP;
    row.forEach((node,column)=>positions.set(node.id,{
      x:(width-rowWidth)/2+column*(CARD_WIDTH+COLUMN_GAP),
      y:verticalPadding+rowIndex*(cardHeight+ROW_GAP),
      rank:rowIndex
    }));
  });
  return {width,height:verticalPadding*2+rows.length*cardHeight+(rows.length-1)*ROW_GAP,cardHeight,positions};
}

function connector(from,to,cardHeight,index,offset=0){
  const startX=from.x+CARD_WIDTH/2+offset,startY=from.y+cardHeight;
  const endX=to.x+CARD_WIDTH/2+offset,endY=to.y-7;
  if(to.rank===from.rank+1){
    const middleY=(startY+endY)/2;
    return {path:`M ${startX} ${startY} C ${startX} ${middleY}, ${endX} ${middleY}, ${endX} ${endY}`,arrow:`M ${endX-4} ${endY-1} L ${endX} ${endY+6} L ${endX+4} ${endY-1}`};
  }
  // Long or returning connections travel through the row gaps and outer gutter.
  const gutter=2+(index%3)*2;
  return {
    path:`M ${startX} ${startY} L ${startX} ${startY+12} L ${gutter} ${startY+12} L ${gutter} ${endY-9} L ${endX} ${endY-9} L ${endX} ${endY}`,
    arrow:`M ${endX-4} ${endY-1} L ${endX} ${endY+6} L ${endX+4} ${endY-1}`
  };
}

/**
 * Render a read-only journey chart from the public, discovered-only journal state.
 * No manifest, storage, event handlers, observers, or undiscovered slots are used.
 * The caller owns styling and the containing pause dialog's scroll behavior.
 */
export function renderJourney(container,state,{currentNodeId=null}={}){
  const document=container.ownerDocument;
  const nodes=[],nodeIds=new Set();
  for(const node of Array.isArray(state?.nodes)?state.nodes:[]){
    if(typeof node?.id!=='string'||nodeIds.has(node.id))continue;
    nodeIds.add(node.id);nodes.push({id:node.id,title:typeof node.title==='string'?node.title:node.id});
  }
  const edges=[],edgeIds=new Set();
  for(const edge of Array.isArray(state?.edges)?state.edges:[]){
    if(typeof edge?.id!=='string'||edgeIds.has(edge.id)||!nodeIds.has(edge.from)||!nodeIds.has(edge.to))continue;
    edgeIds.add(edge.id);edges.push({id:edge.id,from:edge.from,to:edge.to});
  }
  const chart=document.createElement('div');chart.className='journey-chart';
  if(!nodes.length){
    const empty=document.createElement('p');empty.className='journey-chart__empty';
    empty.textContent='Your journey begins when you enter a room.';
    chart.append(empty);container.replaceChildren(chart);return;
  }
  const {width,height,cardHeight,positions}=observedLayout(nodes,edges);
  const graphic=svgElement(document,'svg',{
    class:'journey-chart__svg',viewBox:`0 0 ${width} ${height}`,
    width,height,'aria-hidden':'true',focusable:'false'
  });
  // Three opening branches fit a small screen; wider discovered graphs may scroll.
  graphic.style.minWidth=width>286?`${width}px`:'0';
  const paths=svgElement(document,'g',{'class':'journey-chart__edges'});
  edges.forEach((edge,index)=>{
    const parallel=edges.filter(other=>other.from===edge.from&&other.to===edge.to);
    const lane=parallel.findIndex(other=>other.id===edge.id);
    const offset=parallel.length>1?(lane/(parallel.length-1)-.5)*Math.min(24,(parallel.length-1)*8):0;
    const geometry=connector(positions.get(edge.from),positions.get(edge.to),cardHeight,index,offset);
    paths.append(svgElement(document,'path',{
      class:'journey-chart__edge',d:geometry.path,fill:'none',
      'data-journey-edge':edge.id
    }));
    paths.append(svgElement(document,'path',{class:'journey-chart__arrow',d:geometry.arrow,fill:'none'}));
  });
  graphic.append(paths);
  for(const node of nodes){
    const {x,y}=positions.get(node.id),current=node.id===currentNodeId,lines=titleLines(node.title);
    const group=svgElement(document,'g',{
      class:`journey-chart__node${current?' journey-chart__node--current':''}`,
      'data-journey-node':node.id
    });
    group.append(svgElement(document,'rect',{class:'journey-chart__card',x,y,width:CARD_WIDTH,height:cardHeight,rx:9}));
    const text=svgElement(document,'text',{class:'journey-chart__title',x:x+CARD_WIDTH/2,'text-anchor':'middle'});
    const firstY=current?y+(cardHeight-lines.length*16-14)/2+12:y+cardHeight/2-(lines.length-1)*8+4;
    lines.forEach((line,index)=>{
      const span=svgElement(document,'tspan',{x:x+CARD_WIDTH/2,y:firstY+index*16});
      span.textContent=line;text.append(span);
    });
    group.append(text);
    if(current){
      const label=svgElement(document,'text',{
        class:'journey-chart__current',x:x+CARD_WIDTH/2,y:y+cardHeight-11,'text-anchor':'middle'
      });
      label.textContent='Here';group.append(label);
    }
    graphic.append(group);
  }
  const routes=document.createElement('ol');routes.className='journey-chart__connections';
  routes.setAttribute('aria-label','Visited places and travelled routes');
  const names=new Map(nodes.map(node=>[node.id,node.title]));
  for(const node of nodes){
    const item=document.createElement('li');
    const destinations=[...new Set(edges.filter(edge=>edge.from===node.id).map(edge=>names.get(edge.to)))];
    item.textContent=`${node.title}.${node.id===currentNodeId?' Current room.':''}${destinations.length?` Travelled to ${destinations.join('; ')}.`:''}`;
    routes.append(item);
  }
  chart.append(graphic,routes);container.replaceChildren(chart);
}
