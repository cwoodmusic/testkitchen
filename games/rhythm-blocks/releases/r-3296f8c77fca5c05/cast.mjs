/** A shared, orthographic Pocket Pixel cast; anchors are measured at the boots. */
export const CAST_IMAGE='assets/party-cast.webp';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
/** Each generated sheet has three poses in each of four rows, with measured boots. */
export const NPC_WALKS=freeze({
 nell:{"image":"assets/nell-walk.webp","cellWidth":384,"cellHeight":384,"directions":["down","left","right","up"],"anchors":[[[0.559896,0.932292],[0.49349,0.927083],[0.440104,0.932292]],[[0.539062,0.895833],[0.467448,0.890625],[0.410156,0.893229]],[[0.574219,0.867188],[0.515625,0.861979],[0.460938,0.864583]],[[0.563802,0.867188],[0.492188,0.861979],[0.4375,0.864583]]]},
 iris:{"image":"assets/iris-walk.webp","cellWidth":384,"cellHeight":384,"directions":["down","left","right","up"],"anchors":[[[0.527344,0.927083],[0.5,0.927083],[0.467448,0.927083]],[[0.509115,0.903646],[0.466146,0.903646],[0.451823,0.901042]],[[0.542969,0.895833],[0.514323,0.895833],[0.479167,0.890625]],[[0.536458,0.893229],[0.5,0.893229],[0.47526,0.893229]]]},
 pip:{"image":"assets/pip-walk.webp","cellWidth":384,"cellHeight":384,"directions":["down","left","right","up"],"anchors":[[[0.544271,0.932292],[0.503906,0.929688],[0.466146,0.929688]],[[0.510417,0.921875],[0.476562,0.919271],[0.449219,0.919271]],[[0.548177,0.914062],[0.514323,0.908854],[0.481771,0.914062]],[[0.544271,0.924479],[0.501302,0.927083],[0.466146,0.924479]]]},
 oren:{"image":"assets/oren-walk.webp","cellWidth":384,"cellHeight":384,"directions":["down","left","right","up"],"anchors":[[[0.527344,0.927083],[0.496094,0.927083],[0.497396,0.927083]],[[0.509115,0.927083],[0.485677,0.916667],[0.479167,0.927083]],[[0.515625,0.924479],[0.518229,0.921875],[0.52474,0.924479]],[[0.528646,0.927083],[0.503906,0.927083],[0.494792,0.927083]]]},
});
export const CAST=Object.freeze({
 nell:Object.freeze({column:0,row:0,anchor:Object.freeze([0.501595,0.923445]),walk:NPC_WALKS.nell}),
 iris:Object.freeze({column:1,row:0,anchor:Object.freeze([0.5,0.923445]),walk:NPC_WALKS.iris}),
 pip:Object.freeze({column:0,row:1,anchor:Object.freeze([0.500797,0.918660]),walk:NPC_WALKS.pip}),
 oren:Object.freeze({column:1,row:1,anchor:Object.freeze([0.5,0.918660]),walk:NPC_WALKS.oren}),
});
