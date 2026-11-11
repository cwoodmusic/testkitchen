// Twelve independently drawn soft toys; cardinal views share the same floor
// anchor and physical base so turning a plush never changes its product size.
const rows=[
 ['headphone-whale','Headphone Whale',76,72],
 ['lavender-dragon','Lavender Dragon',64,84],
 ['ukulele-capybara','Ukulele Capybara',66,84],
 ['starry-bunny','Starry Bunny',64,88],
 ['strawberry-frog','Strawberry Frog',64,72],
 ['red-panda','Sleepy Red Panda',64,82],
 ['cloud-cat','Cloud Cat',74,76],
 ['sun-lion','Sunshine Lion',68,82],
 ['mint-robot','Soft Mint Robot',64,82],
 ['moon-owl','Moon Owl',64,78],
 ['mushroom-friend','Mushroom Friend',68,78],
 ['bluebird','Little Songbird',60,66]
];
export const WHIMSICAL_PLUSH_DIRECTIONS=Object.freeze(['south','north','east','west']);
export const WHIMSICAL_PLUSH_DEFINITIONS=Object.freeze(rows.map(([suffix,name,w,h],index)=>Object.freeze({
 id:'plush-'+suffix,name,w,h,index,group:'plushies',purpose:'plush',slot:'toy',layer:'objects',solid:true,
 worldUnit:'town-native',boxes:Object.freeze([Object.freeze({x:w*.24,y:h-17,w:w*.52,h:14})]),
 facing:'south',cardinal:true,kit:'urban',pack:'whimsical-plush-12'
})));
export const whimsicalPlushDefinitions=WHIMSICAL_PLUSH_DEFINITIONS;
