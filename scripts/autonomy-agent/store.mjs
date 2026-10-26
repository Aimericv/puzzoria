import {randomBytes,createHash} from "node:crypto";
import {REPOSITORY,STATE_BRANCH,STATE_PATH,MEMORY_FILES} from "./policy.mjs";

export async function optional(api,path) {
  try {return await api(path);} catch(error) {if(error.status===404) return null;throw error;}
}

export async function readJSON(api,path,ref) {
  const result=await optional(api,`/contents/${path}?ref=${encodeURIComponent(ref)}`);
  if(!result) return null;
  if(result.encoding!=="base64" || result.size>262144) throw new Error("Unexpected state file");
  return JSON.parse(Buffer.from(result.content,"base64").toString("utf8"));
}

export function initialState(control,sourceSha) {
  return {schemaVersion:1,repository:REPOSITORY,generation:0,status:"ready",issueNumber:null,ownerId:null,
    sourceSha,codeSha:null,checkpoint:control.bootstrapCheckpoint,lastMessageId:0,completedSessions:0,
    continuityNonce:randomBytes(24).toString("hex"),nextEligibleAt:null,lastRun:null,
    memory:Object.fromEntries(MEMORY_FILES.map(name=>[name,name==="PLAN.json"?JSON.stringify({summary:"Première session à préparer",nextMission:null,blockedReason:null}):"# Puzzoria\n\nPremière session autonome à préparer.\n"]))};
}

export class StateStore {
  constructor(api,control,sourceSha) {this.api=api;this.control=control;this.sourceSha=sourceSha;this.head=null;this.state=null;}
  async load() {
    const ref=await optional(this.api,`/git/ref/heads/${STATE_BRANCH}`);
    this.head=ref?.object.sha ?? null;
    this.state=this.head ? await readJSON(this.api,STATE_PATH,this.head) : initialState(this.control,this.sourceSha);
    if(!this.state || this.state.repository!==REPOSITORY || this.state.schemaVersion!==1 || !Number.isSafeInteger(this.state.generation)) throw new Error("Invalid persistent state");
    return this.state;
  }
  async save(message="Update autonomous Puzzoria state") {
    const previous=this.head, parent=previous ?? this.sourceSha;
    const actual=await optional(this.api,`/git/ref/heads/${STATE_BRANCH}`);
    if((actual?.object.sha ?? null)!==previous) throw new Error("Agent state changed concurrently; refusing stale publication");
    const parentCommit=await this.api(`/git/commits/${parent}`);
    const next={...this.state,generation:this.state.generation+1};
    const archives=next.growth?.archiveQueue??[];
    if(next.growth){next.growth={...next.growth};delete next.growth.archiveQueue;}
    const content=JSON.stringify(next,null,2)+"\n";
    if(Buffer.byteLength(content)>262144) throw new Error("Persistent state exceeds its limit");
    const records=archives.map(record=>{if(!/^[a-z0-9][a-z0-9-]{2,63}$/.test(record.id))throw Error('Invalid archive identity');const key=createHash('sha256').update(JSON.stringify(record)).digest('hex');return {path:`agent/autonomy/experiments/${key}.json`,mode:'100644',type:'blob',content:JSON.stringify(record,null,2)+'\n'};});
    const tree=await this.api("/git/trees","POST",{base_tree:parentCommit.tree.sha,tree:[{path:STATE_PATH,mode:"100644",type:"blob",content},...records]});
    const commit=await this.api("/git/commits","POST",{message,tree:tree.sha,parents:[parent]});
    if(previous) await this.api(`/git/refs/heads/${STATE_BRANCH}`,"PATCH",{sha:commit.sha,force:false});
    else await this.api("/git/refs","POST",{ref:`refs/heads/${STATE_BRANCH}`,sha:commit.sha});
    this.head=commit.sha;Object.assign(this.state,next);
    return this.state;
  }
}
