/** Observations from the depot. Reading these never supplies notes or a route. */
export const DEPOT_LORE=Object.freeze([
  {
    id:'returned-letter',
    title:'The warm returned letter',
    label:'Inspect the returned letter',
    text:'The old bellkeeper’s seal is still warm. Nell has tied a new forwarding label over several older ones; the last bears the depot’s own star stamp, although none of its outgoing routes are lit.',
  },
  {
    id:'clockwork-roost',
    title:'A courier waiting for a reply',
    label:'Inspect the clockwork roost',
    text:'Pip has left real seed beside a bird made of brass and blue glass. Its crystal throat gives two small clicks, then it turns toward an unlit route and waits for the answer.',
  },
  {
    id:'dispatch-map',
    title:'The sleeping dispatch map',
    label:'Inspect the dispatch map',
    text:'Tiny islands drift behind the curved green glass. One worn brass button still shows Nell’s thumbprint; when pressed, the machine traces the beginning of a journey and stops where the bell’s reply should arrive.',
  },
  {
    id:'route-orrery',
    title:'The star that was rubbed away',
    label:'Inspect the route orrery',
    text:'Someone has polished one star from the old route ring until only a pale circle remains. Its little brass carriage still makes the journey, carefully slowing for a stop that is no longer marked.',
  },
  {
    id:'star-post',
    title:'The star-post receiver',
    label:'Inspect the star-post receiver',
    text:'A local crystal keeps the receiver glowing while its main bell relay hangs disconnected. The delivery tray is warm, and the empty reply socket is worn smooth from being checked.',
  },
].map(entry=>Object.freeze(entry)));
