import {lstatSync, readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {allowedOutput} from "./policy.mjs";

// Called only after every process of the agent UID has stopped. Do not follow
// directories, symlinks or hardlinks created by untrusted development code.
export function collectOutputs(work) {
  for(const directory of ["", "agent", "agent/pilot", "agent/pilot/task", "agent/pilot/memory"]) {
    const stat=lstatSync(join(work,directory));
    if(!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe output directory");
  }
  const files=[];
  for(const directory of ["agent/pilot/task","agent/pilot/memory"]) {
    for(const name of readdirSync(join(work,directory))) {
      const path=directory+"/"+name, full=join(work,path), stat=lstatSync(full);
      if(!allowedOutput(path) || !stat.isFile() || stat.isSymbolicLink() || stat.nlink!==1 || stat.size>1048576) throw new Error("Unsafe output file");
      files.push({path,content:new TextDecoder("utf-8",{fatal:true}).decode(readFileSync(full))});
      if(files.length>32) throw new Error("Pilot output exceeds its publication safety limit");
    }
  }
  return files;
}
