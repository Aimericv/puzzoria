import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {deployTransaction,recoverDeployment} from './deployment-transaction.mjs';
const old='a'.repeat(40),next='b'.repeat(40);
function fixture(t,{badBackup=false,failHealth=false,changeSchema=false}={}) {
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE writes(value TEXT)');t.after(()=>db.close());
 let state={phase:'healthy',currentCommit:old},image='old',switched=false;
 const store={read:async()=>structuredClone(state),write:async s=>{state=structuredClone(s);}};
 const driver={currentImage:async()=>image,schema:async()=>changeSchema&&switched?'changed':'schema',prepare:async()=> 'new',backupAndVerify:async()=>({verified:!badBackup}),switchImage:async value=>{image=value;if(value==='new'){switched=true;db.prepare('INSERT INTO writes VALUES (?)').run('during rollout');}},probe:async value=>{if(value==='new'&&failHealth)throw Error('unhealthy');}};
 return {db,store,driver,get:()=>({state,image})};
}
test('verified backup is mandatory before the first switch',async t=>{const f=fixture(t,{badBackup:true});await assert.rejects(deployTransaction({...f,sha:next,expected:old}),/backup/);assert.equal(f.get().image,'old');});
test('health failure rolls back the image and retains all new database writes',async t=>{
 const f=fixture(t,{failHealth:true});const result=await deployTransaction({...f,sha:next,expected:old});assert.equal(result.phase,'rolled_back');assert.equal(f.get().image,'old');assert.equal(f.db.prepare('SELECT count(*) AS n FROM writes').get().n,1);
});
test('recovery after interrupted switch restores the previous image without a database restore',async t=>{
 const f=fixture(t);await f.store.write({phase:'switching',previousImage:'old',schema:'schema',sha:next,currentCommit:old});await f.driver.switchImage('new');const result=await recoverDeployment(f);assert.equal(result.phase,'rolled_back');assert.equal(f.db.prepare('SELECT count(*) AS n FROM writes').get().n,1);
});
test('unexpected schema change blocks automatic restoration and requires an operator',async t=>{
 const f=fixture(t,{changeSchema:true});await assert.rejects(deployTransaction({...f,sha:next,expected:old}),/schema/);assert.equal(f.get().state.phase,'manual_intervention');
});
test('successful deployments are idempotent and reject stale previous releases',async t=>{
 const f=fixture(t);const result=await deployTransaction({...f,sha:next,expected:old});assert.equal(result.phase,'healthy');assert.equal((await deployTransaction({...f,sha:next,expected:old})).phase,'healthy');await assert.rejects(deployTransaction({...f,sha:'c'.repeat(40),expected:old}),/changed/);
});
