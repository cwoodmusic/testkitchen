#!/usr/bin/env node
/* Actual browser + modular SDK integration against disposable demo emulators. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),tools=path.resolve(process.env.CODA_FIREBASE_TEST_TOOLS||'/tmp/coda-classroom-emulator');
const cli=path.join(tools,'node_modules/firebase-tools/lib/bin/firebase.js');
if(!fs.existsSync(cli)){process.stderr.write('Install the isolated Firebase test toolchain first.\n');process.exit(1);}
const work=fs.mkdtempSync(path.join(os.tmpdir(),'coda-classroom-service-'));
const config=path.join(work,'firebase.json');
fs.writeFileSync(config,JSON.stringify({database:{rules:path.join(root,'classroom-database.rules.json')},emulators:{auth:{host:'127.0.0.1',port:9098},database:{host:'127.0.0.1',port:9102},hub:{host:'127.0.0.1',port:4408},logging:{host:'127.0.0.1',port:4508},ui:{enabled:false},singleProjectMode:true}},null,2));
const quote=value=>"'"+value.replace(/'/g,"'\"'\"'")+"'";
const noProxy=[process.env.NO_PROXY||process.env.no_proxy||'','127.0.0.1','localhost','::1'].filter(Boolean).join(',');
const selectors={'--remembered-session':'tests/remembered-session-world-browser.py','--loading-logout':'tests/loading-logout-world-browser.py','--logout':'tests/classroom-logout-browser.py','--profile-open':'tests/profile-open-loop-browser.py','--world':'tests/classroom-world-browser.py','--teacher-player':'tests/teacher-player-browser.py','--test-mode':'tests/developer-test-mode-auth-browser.py'};
const selected=selectors[process.argv[2]],arguments_=process.argv.slice(selected?3:2);
const command=['python3',quote(path.join(root,selected||'tests/classroom-service-browser.py')),...arguments_.map(quote)].join(' ');
const result=spawnSync(process.execPath,['--require',path.join(root,'tools/firebase-emulator-loopback.cjs'),cli,'emulators:exec','--only','auth,database','--project','demo-coda-classroom-e2e','--config',config,'--non-interactive',command],{cwd:work,stdio:'inherit',env:{...process.env,NO_PROXY:noProxy,no_proxy:noProxy,CODA_FIREBASE_LOOPBACK_PROXY:'1',CODA_FIREBASE_TEST_TOOLS:tools,FIREBASE_EMULATORS_PATH:path.join(tools,'emulator-cache'),XDG_CONFIG_HOME:path.join(tools,'cli-config'),PYTHONDONTWRITEBYTECODE:'1'}});
process.stderr.write('Disposable emulator logs/configuration: '+work+'\n');
if(result.error)process.stderr.write(result.error.message+'\n');
process.exitCode=typeof result.status==='number'?result.status:1;
