// Scene-local coordinates are fractions of the full home artwork, not a roof.
// Houses and their wings stay solid; yards have no baked boundary collision.
export const estateDefinitions=[
 ['bach','Bach · Organ loft estate',1920,.61],['mozart','Mozart · Rose villa',1792,.61],['beethoven','Beethoven · Stormwatch grounds',2304,.61],['clara','Clara · Fern house & garden',1920,.65],['chopin','Chopin · Willow retreat',1920,.65],['haydn','Haydn · Sunflower house',1664,.65],
 ['handel','Handel · Laurel hall',2048,.59],['vivaldi','Vivaldi · Four Seasons villa',1792,.59],['joplin','Scott Joplin · Maple porch',1920,.59],['ellington','Duke Ellington · Bluebird manor',2304,.63],['ella','Ella · Honeysuckle home',1792,.65],['nina','Nina · Cedar sanctuary',2304,.65],
 ['miles','Miles · River bend estate',1920,.59],['dj','DJ Coda · Nightjar studio',2048,.59],['vee-jay','Vee Jay · Prism villa',1920,.59],['zizi','Zizi · Wildflower home',2048,.61],['metronome','Metronome · Clockmaker grounds',1792,.63],['schoenberg','Schoenberg · Twelve-tone lodge',2048,.64],
 ['player','Your home · Library garden estate',2048,.62]
].map(([id,name,sourceSize,front],i)=>({id,name,sourceSize,size:id==='player'?sourceSize:Math.round(sourceSize*.85),front,index:i}));
export function estateBoxes(a){const s=a.size;const wings=['clara','nina','vee-jay','player'].includes(a.id)?[{x:s*.83,y:s*.22,w:s*.11,h:s*(a.front-.22)}]:[];return [...wings,
 {x:s*.13,y:s*.035,w:s*.75,h:s*(a.front-.035)}
];}
