/* Source and explicit mask for the northwest top-cap neon route.
 * The aggregate finishing compositor is the sole native PNG writer. */
'use strict';
const meta=require('./northwest-neon-cap-regions.json');
const {cleanupMask}=require('./build-walkway-cleanup.cjs');
const mask=()=>cleanupMask(meta);
module.exports={meta,mask};
