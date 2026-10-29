"""Exercise world destinations through their physical interaction points."""


def advance_world(page,milliseconds=96):
    # run_for() installs a clock when absent. Keep real-time fixtures real,
    # especially across reloads, and advance only explicitly installed clocks.
    if page.evaluate('typeof globalThis.__pwClock!=="undefined"'):
        page.clock.run_for(milliseconds)
    else:
        page.wait_for_timeout(milliseconds)


def close_settings(page):
    if page.locator('body').evaluate("node=>node.classList.contains('world-menu-open')"):
        page.keyboard.press('Escape');advance_world(page,32)


def open_settings(page):
    if not page.locator('body').evaluate("node=>node.classList.contains('world-menu-open')"):
        page.locator('#worldMenuBtn').click();advance_world(page,32)


def _close_world_panels(page):
    close_settings(page)
    if page.locator('#panel').is_visible():
        page.locator('#panelClose').click();advance_world(page,32)
    if page.locator('#dialog').is_visible():
        page.locator('#close').click();advance_world(page,32)


def _place_near(page,points):
    placed=page.evaluate('''points=>{
      const candidates=[];
      for(const point of points){
        candidates.push(point);
        for(let radius=5;radius<=65;radius+=5)
          for(let index=0;index<16;index++){
            const angle=index*Math.PI/8;
            candidates.push({x:point.x+Math.cos(angle)*radius,y:point.y+Math.sin(angle)*radius});
          }
      }
      for(const point of candidates)if(CodaArcadeQA.place(point.x,point.y))return point;
      return null;
    }''',points)
    if not placed:raise AssertionError('No walkable approach to this world destination: '+str(points))
    advance_world(page)
    page.locator('#view').focus()
    return placed


def _interact(page):
    page.keyboard.press('e');advance_world(page)


def enter_room(page,kind):
    kind={'cave':'fishing'}.get(kind,kind)
    if kind not in ('piano','classroom','fishing'):raise ValueError('Unknown room: '+str(kind))
    _close_world_panels(page)
    entrance=page.evaluate('''kind=>{
      const entries=CodaArcadeQA.entrances();
      const entry=entries.find(item=>item.name.toLowerCase().includes(kind==='classroom'?'classroom':kind==='fishing'?'fishing':'piano'))
        ||(kind==='fishing'?CodaArcadeQA.fishingEntrance():null);
      if(!entry)return null;
      return {name:entry.name,approach:entry.approach||{x:entry.x,y:entry.y},x:entry.x,y:entry.y};
    }''',kind)
    if not entrance:raise AssertionError('The physical '+kind+' entrance is unavailable')
    _place_near(page,[entrance['approach']])
    _interact(page)
    state=page.evaluate('kind=>CodaArcadeQA[kind]()',kind)
    if not state.get('open'):
        raise AssertionError('The physical '+kind+' entrance did not open: '+str({
            'entrance':entrance,'position':page.evaluate('CodaArcadeQA.position()'),
            'conversation':page.evaluate('CodaArcadeQA.conversation()')}))
    return state


def open_destination(page,kind):
    if kind not in ('boutique','shop','dj','fame'):raise ValueError('Unknown world destination: '+str(kind))
    _close_world_panels(page)
    points=page.evaluate('''kind=>{
      if(kind==='boutique'||kind==='shop'){
        const type=kind==='boutique'?'shop':'notes-shop';
        const person=CodaArcadeQA.shopkeepers().find(item=>item.type===type&&item.visible);
        return person?.approaches||[];
      }
      if(kind==='dj'){const dj=CodaArcadeQA.dj();return dj.visible?[{x:dj.approachX,y:dj.approachY}]:[];}
      return [{x:1460,y:318},{x:1460,y:360}];
    }''',kind)
    if not points:raise AssertionError('The physical '+kind+' interaction point is unavailable')
    _place_near(page,points);_interact(page)
    if not page.locator('#panel').is_visible():
        raise AssertionError('The physical '+kind+' interaction did not open its panel')


def approach_musician(page,person):
    _close_world_panels(page)
    visitor=page.evaluate('id=>CodaArcadeQA.characters().npcs.find(item=>item.id===id)',person)
    if not visitor:raise AssertionError('The musician is unavailable: '+person)
    if visitor['hidden']:
        if not page.evaluate('id=>CodaArcadeQA.findMusician(id)',person):
            raise AssertionError('This musician cannot visit yet: '+person)
        # Use the normal invitation and entrance arrival. Keep rotation active;
        # the other visitors still finish leaving through the arcade entrance.
        for _ in range(120):
            advance_world(page,250)
            visitor=page.evaluate('id=>CodaArcadeQA.characters().npcs.find(item=>item.id===id)',person)
            if not visitor['hidden']:break
        if visitor['hidden']:
            raise AssertionError('The invited musician did not arrive: '+str({
                'id':person,'visitors':page.evaluate('CodaArcadeQA.visitors()')}))
    points=page.evaluate('''id=>{
      const person=CodaArcadeQA.characters().npcs.find(item=>item.id===id&&!item.hidden);
      return person?[{x:person.x,y:person.y},{x:person.x+18,y:person.y},{x:person.x-18,y:person.y}]:[];
    }''',person)
    if not points:raise AssertionError('The musician is unavailable: '+person)
    return _place_near(page,points)


def talk_to_musician(page,person):
    approach_musician(page,person);_interact(page)
    conversation=page.evaluate('CodaArcadeQA.conversation()')
    if not conversation['open'] or conversation['id']!=person:
        raise AssertionError('Expected a physical conversation with '+person+': '+str(conversation))


def open_cabinet(page,index):
    _close_world_panels(page)
    game=page.evaluate('''index=>CodaArcadeQA.worldObjects()
      .find(object=>object.game?.index===index)?.game''',index)
    if not game:raise AssertionError('The cabinet is unavailable: '+str(index))
    _place_near(page,[{'x':game.get('npcX',game['x']),'y':game.get('npcY',game['y'])}])
    _interact(page)
    if not page.evaluate('CodaArcadeQA.menu().gameOpen'):
        raise AssertionError('The physical cabinet did not open: '+game['name'])
