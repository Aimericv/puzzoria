import test from "node:test";
import assert from "node:assert/strict";
import {validateTarget,verifyTask,redact} from "./run.mjs";

test("submission requires a confirmed exact ID from the new environment settings URL",() => {
  const target={environmentId:"new-environment-123",environmentUrl:"https://chatgpt.com/codex/settings/environments/new-environment-123",verifiedNewEnvironment:true};
  assert.equal(validateTarget(target),target.environmentId);
  for(const invalid of [null,{}, {...target,verifiedNewEnvironment:false}, {...target,environmentId:"Puzzoria"}, {...target,environmentUrl:"https://example.com/new-environment-123"}, {...target,environmentUrl:"https://chatgpt.com/codex/settings/environments/old-environment"}])
    assert.throws(()=>validateTarget(invalid));
});

test("a created task must report the exact target environment, never a legacy environment",() => {
  const task={id:"task_one",environment_id:"new-environment",status:"ready",summary:{files_changed:0},attempt_total:1,is_review:false};
  assert.equal(verifyTask({tasks:[task]},"task_one","new-environment").status,"ready");
  assert.equal(verifyTask({tasks:[task]},"another-task","new-environment"),null);
  assert.throws(()=>verifyTask({tasks:[{...task,environment_id:"legacy-environment"}]},"task_one","new-environment"));
  assert.throws(()=>verifyTask({tasks:[{...task,environment_id:null}]},"task_one","new-environment"));
  assert.throws(()=>verifyTask({tasks:[{...task,attempt_total:2}]},"task_one","new-environment"));
});

test("native runtime metadata can identify the new configuration without making the user find a URL",() => {
  const environmentId="owner~cecfg_new_configuration";
  const target={environmentId,verifiedNewEnvironment:true,discovery:{method:"cloud_environment.environment_status",sourceConfigId:environmentId,sourceConfigVersionId:"owner~cecfgver_current",runtimeEnvironmentId:"ccarenv_current",observationsCurrent:true}};
  assert.equal(validateTarget(target),environmentId);
  for(const discovery of [{...target.discovery,sourceConfigId:"legacy-id"},{...target.discovery,observationsCurrent:false},{...target.discovery,runtimeEnvironmentId:null},{...target.discovery,sourceConfigVersionId:null}])
    assert.throws(()=>validateTarget({...target,discovery}));
});

test("diagnostic output removes checkpoint secrets, bearer values and JWTs",() => {
  const diagnostic=redact("token=fake-refresh-secret Bearer fake-bearer-token eyJhbGciOi.fake-payload.fake-signature",["fake-refresh-secret"]);
  for(const secret of ["fake-refresh-secret","fake-bearer-token","eyJhbGciOi.fake-payload.fake-signature"]) assert.equal(diagnostic.includes(secret),false);
});
