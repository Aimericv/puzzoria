import {createInterface} from "node:readline";

// Never print the protocol stream: it can contain account information and tool output.
export class Rpc {
  constructor(child) {
    this.child=child; this.next=0; this.pending=new Map(); this.listeners=[];
    createInterface({input:child.stdout}).on("line", line => {
      let msg; try {msg=JSON.parse(line);} catch {return;}
      if (msg.id !== undefined && !msg.method) {
        const pending=this.pending.get(msg.id);
        if (pending) {
          this.pending.delete(msg.id); clearTimeout(pending.timer);
          if(msg.error) pending.reject(new Error(`RPC ${pending.method} failed (${msg.error.code})`));
          else pending.resolve(msg.result);
        }
      } else if (msg.id !== undefined) {
        // No approvals, purchases, OAuth flows, or external connectors are delegated to the model.
        this.send({id:msg.id,error:{code:-32601,message:"Unavailable in the bounded pilot"}});
      } else for (const listener of this.listeners) listener(msg);
    });
    child.on("exit",()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error("Codex process exited"));}this.pending.clear();});
  }
  send(msg) {this.child.stdin.write(JSON.stringify(msg)+"\n");}
  request(method, params={}) {
    const id=++this.next;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`RPC ${method} timed out`));},60000);
      this.pending.set(id,{resolve,reject,timer,method}); this.send({id,method,params});
    });
  }
  async turn(threadId, text) {
    let listener, onExit;
    const finished=new Promise((resolve,reject)=>{
      listener=msg=>{
        if(msg.method==="turn/completed" && msg.params.threadId===threadId){
          if(msg.params.turn.status==="completed") resolve();
          else reject(new Error("Codex turn did not complete"));
        }
      };
      this.listeners.push(listener);
      onExit=()=>reject(new Error("Codex exited during the turn"));
      this.child.once("exit",onExit);
    });
    try {
      await Promise.all([this.request("turn/start",{threadId,input:[{type:"text",text}]}),finished]);
    } finally {
      this.listeners=this.listeners.filter(l=>l!==listener);
      this.child.removeListener("exit",onExit);
    }
  }
}
