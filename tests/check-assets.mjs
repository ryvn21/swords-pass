import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve('dist');let modules=0,assets=0;
for(const f of fs.readdirSync(root)){const full=path.join(root,f);if(f.endsWith('.js')){const check=spawnSync(process.execPath,['--check',full],{encoding:'utf8'});if(check.status!==0)throw Error(check.stderr);modules++;const text=fs.readFileSync(full,'utf8');for(const m of text.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g)){if(!fs.existsSync(path.resolve(root,m[1])))throw Error('Missing import '+m[1]);}}assets++;}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const m of html.matchAll(/(?:src|href)="(\/[^"?#]*)"/g)){if(m[1]==='/')continue;if(!fs.existsSync(path.join(root,m[1])))throw Error('Missing entry asset '+m[1]);}
console.log(JSON.stringify({modulesChecked:modules,staticAssets:assets,entrypoints:'valid'}));
