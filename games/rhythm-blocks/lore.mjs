/** Observations from the depot. Reading these never supplies notes or a route. */
export const DEPOT_LORE=Object.freeze([
  {
    id:'returned-letter',
    title:'The warm returned letter',
    label:'Inspect the returned letter',
    text:"A star-shaped stamp closes the letter with red wax. The wax is still warm. Nell’s newest address label sits over several older labels. The last one sends the letter back to this very post office.",
  },
  {
    id:'clockwork-roost',
    title:"A mail bird waiting for a reply",
    label:"Inspect the mail bird",
    text:"This clockwork mail bird is made of brass and blue glass. It gives two clicks, turns toward a dark route, and waits. Pip has put seed beside it, even though its key supplies its power.",
  },
  {
    id:'dispatch-map',
    title:"The mail-route screen",
    label:"Inspect the mail-route screen",
    text:"The green screen shows the islands and their mail routes. Pressing its brass button sends a bright line toward an island. The line stops where a reply should return. No reply appears.",
  },
  {
    id:'route-orrery',
    title:"The missing stop on the map",
    label:"Inspect the old route model",
    text:"One island mark has worn off this old model of the mail routes. A tiny metal carriage still slows at the empty place. The model remembers a stop that Nell’s newer map does not show.",
  },
  {
    id:'star-post',
    title:"The mail signal receiver",
    label:"Inspect the mail signal receiver",
    text:"A crystal still lights this machine, which receives mail signals. Its cable to the great bell hangs loose. The delivery tray is warm, but the space for a reply stays dark.",
  },
].map(entry=>Object.freeze(entry)));
