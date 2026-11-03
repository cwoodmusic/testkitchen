/* Remove the stale Hall floor rectangle and deleted-lamp reflection. */
'use strict';
const meta=require('./hall-floor-repair-regions.json');
async function build(options={}){
 return require('./build-walkway-cleanup.cjs').build({...options,meta});
}
if(require.main===module)build({dryRun:process.argv.includes('--dry-run'),previewOnly:process.argv.includes('--preview-mask')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={build};
