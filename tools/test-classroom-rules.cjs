#!/usr/bin/env node
/* Run a demo-project emulator only, with dependencies outside the static site. */
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const tools=path.resolve(process.env.CODA_FIREBASE_TEST_TOOLS||'/tmp/coda-classroom-emulator');
const cli=path.join(tools,'node_modules/firebase-tools/lib/bin/firebase.js');
const root=path.resolve(__dirname,'..'),rules=path.join(root,'classroom-database.rules.json');
if(!fs.existsSync(cli)||!fs.existsSync(rules)){
 process.stderr.write('Install the isolated Firebase test toolchain and generate classroom-database.rules.json first. See README-CLASSROOM-PROFILES.md.\n');process.exit(1);
}
const work=fs.mkdtempSync(path.join(os.tmpdir(),'coda-classroom-rules-'));
const config=path.join(work,'firebase.json');
fs.writeFileSync(config,JSON.stringify({database:{rules},emulators:{database:{host:'127.0.0.1',port:9100},hub:{host:'127.0.0.1',port:4410},logging:{host:'127.0.0.1',port:4510},ui:{enabled:false},singleProjectMode:false}},null,2)+'\n');
const quote=value=>"'"+value.replace(/'/g,"'\"'\"'")+"'";
const preload=path.join(__dirname,'firebase-emulator-loopback.cjs');
const command=quote(process.execPath)+' --require '+quote(preload)+' --test '+quote(path.join(root,'tests/classroom-database.emulator.cjs'));
const result=spawnSync(process.execPath,['--require',preload,cli,'emulators:exec','--only','database','--project','demo-coda-classroom-rules','--config',config,'--non-interactive',command],{
 cwd:work,stdio:'inherit',env:{...process.env,CODA_FIREBASE_TEST_TOOLS:tools,CODA_FIREBASE_LOOPBACK_PROXY:'1',FIREBASE_EMULATORS_PATH:path.join(tools,'emulator-cache'),XDG_CONFIG_HOME:path.join(tools,'cli-config')}
});
process.stderr.write('Local emulator configuration/log directory: '+work+'\n');
if(result.error)process.stderr.write(result.error.message+'\n');
process.exitCode=typeof result.status==='number'?result.status:1;
