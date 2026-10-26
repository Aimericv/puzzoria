import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {validateRelease} from './release-validation.mjs';
import {assertFunding} from './policy.mjs';
assertFunding(JSON.parse(readFileSync('agent/autonomy/control.json','utf8')));
const git=(...args)=>execFileSync('git',['-c',`safe.directory=${process.cwd()}`,...args],{encoding:'utf8'}).trim();
const head=git('rev-parse','HEAD'),base=git('rev-parse','origin/main'),tree=git('rev-parse','HEAD^{tree}');
git('merge-base','--is-ancestor',base,head);
validateRelease({head,base,tree});
