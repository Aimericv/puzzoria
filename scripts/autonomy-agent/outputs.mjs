import {lstatSync,readFileSync,readdirSync,readlinkSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {allowedCandidate,MEMORY_FILES} from "./policy.mjs";

export function safeFile(root,path,maximum=1048576) {
  const parts=path.split("/");
  for(let count=1;count<=parts.length;count++) {
    const stat=lstatSync(join(root,...parts.slice(0,count)));
    if(stat.isSymbolicLink() || (count===parts.length ? !stat.isFile()||stat.nlink!==1||stat.size>maximum : !stat.isDirectory())) throw new Error("Unsafe candidate file or parent");
  }
  return readFileSync(join(root,path));
}

export function restoreNextEnv(root,baseline) {
  const path="next-env.d.ts", original=baseline.get(path);
  if(!original) return;
  const current=safeFile(root,path);
  const normalize=value=>value.toString().replace(/^import "\.\/\.next[^"\n]*\/types\/(routes|root-params)\.d\.ts";$/gm,'import "./GENERATED/types/$1.d.ts";');
  if(normalize(current)!==normalize(original)) throw new Error("Protected Next environment declarations changed beyond generated imports");
  writeFileSync(join(root,path),original);
}

export function collectCandidate(root,baseline) {
  const files=[];
  if(readlinkSync(join(root,"node_modules"))!=="/opt/puzzoria-agent-deps/node_modules") throw new Error("Approved dependencies were replaced");
  function audit(directory="") {
    for(const name of readdirSync(join(root,directory))) {
      const path=directory?`${directory}/${name}`:name,stat=lstatSync(join(root,path));
      if(path==="node_modules") continue;
      if(stat.isSymbolicLink()) throw new Error("Linked workspace paths are forbidden");
      if(!directory && (/^\.next(?:-|\/|$)/.test(name) || [".tmp",".sites-runtime",".data","test-results","playwright-report",".agent-tests.json",".sandbox-write-test"].includes(name) || name.endsWith(".tsbuildinfo"))) continue;
      if(stat.isDirectory()) audit(path);
      else {
        const memory=path.startsWith("agent/autonomy/memory/")&&MEMORY_FILES.includes(path.slice("agent/autonomy/memory/".length));
        if(!baseline.has(path)&&!allowedCandidate(path)&&!memory) throw new Error(`Unapproved workspace file could affect validation: ${path}`);
      }
    }
  }
  audit();
  for(const [path,original] of baseline) {
    if(allowedCandidate(path)) continue;
    if(!safeFile(root,path,Math.max(1048576,original.length)).equals(original)) throw new Error(`Protected repository file changed: ${path}`);
  }
  const present=new Set();
  function walk(directory) {
    if(!lstatSync(join(root,directory)).isDirectory() || lstatSync(join(root,directory)).isSymbolicLink()) throw new Error("Unsafe candidate directory");
    for(const name of readdirSync(join(root,directory))) {
      const path=`${directory}/${name}`, stat=lstatSync(join(root,path));
      if(stat.isSymbolicLink()) throw new Error("Linked candidate paths are forbidden");
      if(stat.isDirectory()) walk(path);
      else {
        if(!allowedCandidate(path)) {
          if(!baseline.has(path)) throw new Error(`Publication outside the application allowlist: ${path}`);
          continue;
        }
        present.add(path);
        const data=safeFile(root,path);
        if(!baseline.get(path)?.equals(data)) files.push({path,content:new TextDecoder("utf8",{fatal:true}).decode(data)});
      }
    }
  }
  for(const directory of ["src","tests","e2e","docs"]) walk(directory);
  for(const path of baseline.keys()) if(allowedCandidate(path)&&!present.has(path)) files.push({path,deleted:true});
  if(files.length>80 || files.reduce((sum,file)=>sum+Buffer.byteLength(file.content ?? ""),0)>2097152) throw new Error("Candidate publication exceeds the safety bound");
  return files;
}

export function collectMemory(root,nonce) {
  const memory={};
  for(const name of MEMORY_FILES) {
    const content=new TextDecoder("utf8",{fatal:true}).decode(safeFile(root,`agent/autonomy/memory/${name}`));
    if(Buffer.byteLength(content)>32768) throw new Error("Memory exceeds its publication bound");
    memory[name]=content;
  }
  const plan=JSON.parse(memory["PLAN.json"]);
  if(plan.continuityNonce!==nonce || typeof plan.summary!=="string" || typeof plan.nextMission!=="string" ||
    ![null,"string"].includes(plan.blockedReason===null?null:typeof plan.blockedReason)) throw new Error("The prior GitHub memory was not preserved or the next mission is missing");
  return {memory,plan};
}
