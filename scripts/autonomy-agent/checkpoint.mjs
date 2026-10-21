import {createHash} from "node:crypto";
import {readFileSync,writeFileSync,mkdirSync,watch} from "node:fs";
import {join} from "node:path";
import {seal,unseal} from "../autonomy-pilot/vault.mjs";
import {REPOSITORY} from "./policy.mjs";

export async function artifactClient() {
  const {DefaultArtifactClient}=await import(new URL("../autonomy-pilot/runtime/node_modules/@actions/artifact/lib/artifact.js",import.meta.url));
  return new DefaultArtifactClient();
}

export function checkedAuth(value) {
  if(!value?.tokens?.access_token || !value.tokens.refresh_token || value.OPENAI_API_KEY || value.auth_mode==="apikey")
    throw new Error("Managed ChatGPT authentication required; refusing API or empty credentials");
  return value;
}

export function recoveryPointer(metadata,artifact) {
  const context=metadata?.context;
  if(context?.repository!==REPOSITORY || context.phase!=="autonomous-agent" ||
    !/^\d+$/.test(context.runId ?? "") || !Number.isSafeInteger(context.generation) || context.generation<1 ||
    artifact.name!==`puzzoria-agent-auth-${context.runId}-${context.generation}` || artifact.workflow_run?.id!==Number(context.runId))
    throw new Error("Checkpoint recovery provenance mismatch");
  return {artifactId:artifact.id,runId:context.runId,name:artifact.name,generation:context.generation,context,expiresAt:artifact.expires_at};
}

export class Checkpoints {
  constructor({api,store,key,runId,authFile,directory,client}) {
    Object.assign(this,{api,store,key,runId,authFile,directory,client});
    this.queue=Promise.resolve();this.hash=null;this.watcher=null;this.failure=null;
  }
  async download(pointer,destination) {
    const metadata=await this.api(`/actions/artifacts/${pointer.artifactId}`);
    if(metadata.expired || metadata.name!==pointer.name || metadata.workflow_run?.id!==Number(pointer.runId)) throw new Error("Latest checkpoint is expired or has unexpected provenance; never roll back");
    const result=await this.client.downloadArtifact(pointer.artifactId,{path:destination,expectedHash:metadata.digest,findBy:{token:process.env.GITHUB_TOKEN,workflowRunId:Number(pointer.runId),repositoryOwner:"Aimericv",repositoryName:"puzzoria"}});
    if(result.digestMismatch) throw new Error("Artifact digest verification failed");
    return metadata;
  }
  async restore() {
    mkdirSync(this.directory,{recursive:true,mode:0o700});
    const newer=[];
    for(let page=1;;page++) {
      const {artifacts}=await this.api(`/actions/artifacts?per_page=100&page=${page}`);
      for(const artifact of artifacts) {
        const match=/^puzzoria-agent-auth-\d+-(\d+)$/.exec(artifact.name);
        if(match && Number(match[1])>(this.store.state.checkpoint.generation ?? 0)) newer.push(artifact);
      }
      if(artifacts.length<100) break;
      if(page>=20) throw new Error("Incomplete checkpoint discovery; refusing a possibly stale login");
    }
    if(newer.length) {
      newer.sort((a,b)=>Number(b.name.split("-").at(-1))-Number(a.name.split("-").at(-1)));
      if(newer[1]?.name.split("-").at(-1)===newer[0].name.split("-").at(-1)) throw new Error("Ambiguous checkpoint generation");
      const artifact=newer[0], destination=join(this.directory,"recovery");
      await this.download({artifactId:artifact.id,name:artifact.name,runId:String(artifact.workflow_run.id)},destination);
      const pointer=recoveryPointer(JSON.parse(readFileSync(join(destination,"checkpoint.json"),"utf8")),artifact);
      const auth=checkedAuth(unseal(readFileSync(join(destination,"auth.enc"),"utf8"),this.key,pointer.context));
      this.store.state.checkpoint=pointer;
      await this.store.save("Recover the latest uploaded authentication checkpoint");
      return auth;
    }
    const destination=join(this.directory,"current");
    await this.download(this.store.state.checkpoint,destination);
    return checkedAuth(unseal(readFileSync(join(destination,"auth.enc"),"utf8"),this.key,this.store.state.checkpoint.context));
  }
  flush() {
    this.queue=this.queue.then(async()=>{
      const raw=readFileSync(this.authFile,"utf8"), hash=createHash("sha256").update(raw).digest("hex");
      if(hash===this.hash) return;
      const auth=checkedAuth(JSON.parse(raw));
      const generation=(this.store.state.checkpoint.generation ?? 0)+1;
      const context={repository:REPOSITORY,runId:this.runId,phase:"autonomous-agent",generation};
      const name=`puzzoria-agent-auth-${this.runId}-${generation}`, folder=join(this.directory,`generation-${generation}`);
      mkdirSync(folder,{recursive:true,mode:0o700});
      writeFileSync(join(folder,"auth.enc"),seal(auth,this.key,context),{mode:0o600});
      writeFileSync(join(folder,"checkpoint.json"),JSON.stringify({context}),{mode:0o600});
      const retentionDays=Math.min(90,Number(process.env.GITHUB_RETENTION_DAYS)||90);
      const result=await this.client.uploadArtifact(name,[join(folder,"auth.enc"),join(folder,"checkpoint.json")],folder,{retentionDays,compressionLevel:0});
      if(!Number.isSafeInteger(result.id)) throw new Error("Checkpoint upload did not return a confirmed artifact ID");
      const metadata=await this.api(`/actions/artifacts/${result.id}`);
      if(metadata.expired || !metadata.expires_at) throw new Error("Checkpoint expiry unavailable after upload");
      this.store.state.checkpoint={artifactId:result.id,runId:this.runId,name,generation,context,expiresAt:metadata.expires_at,digest:result.digest ?? null};
      await this.store.save("Preserve renewed Plus authentication before further work");
      this.hash=hash;
    });
    return this.queue;
  }
  start(onFailure) {
    this.watcher=watch(join(this.authFile,".."),(_event,name)=>{
      if(name!=="auth.json") return;
      this.flush().catch(error=>{this.failure=error;onFailure(error);});
    });
  }
  async stop() {this.watcher?.close();this.watcher=null;await this.queue;}
}
