/* Geometry/source metadata only. The aggregate finishing coordinator owns all
 * native backdrop writes and preserves the original LOUNGE sign verbatim. */
'use strict';
const metadata=require('./lounge-center-wall-regions.json');
const {cleanupMask}=require('./build-walkway-cleanup.cjs');

const centerWallMask=()=>cleanupMask(metadata);
const compositorMeta=()=>({...metadata,preserveProject:true});
module.exports={metadata,centerWallMask,compositorMeta};
