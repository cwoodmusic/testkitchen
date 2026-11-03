/* Final reviewed negative-space and northwest neon pass. */
'use strict';
const meta=require('./five-northwest-cleanup-regions.json');
async function build(options={}){
 return require('./build-walkway-cleanup.cjs').build({...options,meta});
}
if(require.main===module)build({dryRun:process.argv.includes('--dry-run'),previewOnly:process.argv.includes('--preview-mask')}).catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
module.exports={build};
