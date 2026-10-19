import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {NextRequest,NextResponse} from "next/server";
import {database,closeDatabase} from "../src/lib/server/database";
import {account,authenticate,createSession,hashPassword,changePassword,logoutAll} from "../src/lib/server/auth";
import {credentialVersion} from "../src/lib/server/credentials";
import {issueRecoveryCode,recoverAccount} from "../src/lib/server/recovery";
import {digest,rateLimit,requestAddress} from "../src/lib/server/http";
import {validateNewPassword} from "../src/lib/server/password-policy";
import {deploymentReady} from "../src/lib/server/deployment";
import {GET as roomRead} from "../src/app/api/number-rooms/route";
import {POST as accountPost} from "../src/app/api/account/route";
import {proxy} from "../src/proxy";
import {contentSecurityPolicy} from "../src/lib/security-headers";

const original="original audit passphrase",updated="updated audit passphrase";
const request=(cookie="",body:Record<string,unknown>={})=>new NextRequest("http://localhost/api/account",{method:"POST",headers:{cookie,"content-type":"application/json",origin:"http://localhost"},body:JSON.stringify(body)});
beforeEach(()=>{closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");vi.stubEnv("TRUST_PROXY","false");vi.stubEnv("AUTH_ORIGIN","http://localhost");vi.stubEnv("NEXT_PUBLIC_SITE_URL","http://localhost:3000");});
afterEach(()=>{closeDatabase();vi.unstubAllEnvs();});
async function setup(){const user=await authenticate(request(),{username:"audit_user",password:original},true);const response=NextResponse.json({});createSession(request(),response,user);return {user,cookie:`dailygrid-session=${response.cookies.get("dailygrid-session")!.value}`};}

it("rejects an old-password authentication that is hashing during a password reset",async()=>{
 const {user}=await setup();const replacement=await hashPassword(updated);
 const pending=authenticate(request(),{username:"audit_user",password:original},false);
 database().prepare("UPDATE users SET password_hash=? WHERE id=?").run(replacement,user.id);
 await expect(pending).rejects.toMatchObject({code:"credentialsInvalid"});
});
it("rejects an already-verified authentication after recovery and keeps public account objects free of proofs",async()=>{
 const {user}=await setup();const code=issueRecoveryCode(user.id);
 await recoverAccount(request(),{username:user.username,recoveryCode:code,password:updated,confirmPassword:updated});
 expect(()=>createSession(request(),NextResponse.json({}),user)).toThrow("credentialsInvalid");
 expect(Object.keys(user).sort()).toEqual(["displayName","id","username"]);
 const fresh=await authenticate(request(),{username:user.username,password:updated},false);
 expect(()=>createSession(request(),NextResponse.json({}),fresh)).not.toThrow();
});
it("rotates the current session on password change, revokes other devices and preserves the recovery code",async()=>{
 const {user,cookie}=await setup();const second=NextResponse.json({});createSession(request(),second,user);const code=issueRecoveryCode(user.id);
 const saved=database().prepare("SELECT code_hash FROM account_recovery WHERE user_id=?").get(user.id);
 const response=await accountPost(request(cookie,{action:"change-password",password:original,newPassword:updated,confirmPassword:updated}));
 expect(response.status).toBe(200);const nextCookie=`dailygrid-session=${response.cookies.get("dailygrid-session")!.value}`;
 expect(account(request(nextCookie))?.id).toBe(user.id);expect(account(request(cookie))).toBeNull();
 expect(account(request(`dailygrid-session=${second.cookies.get("dailygrid-session")!.value}`))).toBeNull();
 expect(database().prepare("SELECT code_hash FROM account_recovery WHERE user_id=?").get(user.id)).toEqual(saved);
 expect(JSON.stringify(await response.json())).not.toContain(code);expect(credentialVersion(user.id)).toBe(1);
 await expect(authenticate(request(),{username:user.username,password:original},false)).rejects.toMatchObject({code:"credentialsInvalid"});
});
it("leaves password and sessions unchanged on a wrong current password, mismatch or weak replacement",async()=>{
 const {user,cookie}=await setup();const row=database().prepare("SELECT password_hash FROM users WHERE id=?").get(user.id);
 for(const body of [{password:"wrong audit passphrase",newPassword:updated,confirmPassword:updated},{password:original,newPassword:updated,confirmPassword:original},{password:original,newPassword:"password123456",confirmPassword:"password123456"}]){
   const response=await accountPost(request(cookie,{action:"change-password",...body}));expect(response.ok).toBe(false);expect(account(request(cookie))?.id).toBe(user.id);
 }
 expect(database().prepare("SELECT password_hash FROM users WHERE id=?").get(user.id)).toEqual(row);
});
it("logout-all rejects pending and previously verified logins, including when the password stays unchanged",async()=>{
 const {user,cookie}=await setup();const pending=authenticate(request(),{username:user.username,password:original},false);
 const response=NextResponse.json({});await logoutAll(request(cookie),response,user,original);
 const outcome=await pending.then(value=>({value}),error=>({error}));
 if("value" in outcome)expect(()=>createSession(request(),NextResponse.json({}),outcome.value)).toThrow("credentialsInvalid");
 else expect(outcome.error).toMatchObject({code:"credentialsInvalid"});
 expect(account(request(cookie))).toBeNull();expect(response.cookies.get("dailygrid-session")?.maxAge).toBe(0);
 expect(()=>createSession(request(),NextResponse.json({}),user)).toThrow("credentialsInvalid");
});
it("allows only one concurrent password change",async()=>{
 const {user,cookie}=await setup();const outcomes=await Promise.allSettled([updated,"another audit passphrase"].map(newPassword=>changePassword(request(cookie),NextResponse.json({}),user,{password:original,newPassword,confirmPassword:newPassword})));
 expect(outcomes.filter(o=>o.status==="fulfilled")).toHaveLength(1);expect(credentialVersion(user.id)).toBe(1);
});
it("blocks new common passwords without invalidating existing login passwords",async()=>{
 for(const value of ["password123456","motdepasse123","aaaaaaaaaaaa","123456789012"])expect(()=>validateNewPassword(value)).toThrow("passwordWeak");
 expect(()=>validateNewPassword("a long original phrase 🧩")).not.toThrow();
 await expect(authenticate(request(),{username:"weak_user",password:"password123456"},true)).rejects.toMatchObject({code:"passwordWeak"});
 const hash=await hashPassword("password123456");database().prepare("INSERT INTO users VALUES(?,?,?,?,?)").run("legacy","legacy_user","Legacy",hash,new Date().toISOString());
 await expect(authenticate(request(),{username:"legacy_user",password:"password123456"},false)).resolves.toMatchObject({id:"legacy"});
});
it("limits room reads before minting rotating cookie-less identities",async()=>{
 database().prepare("INSERT INTO rate_limits VALUES(?,?,?)").run(digest("room-read-address:direct"),1200,Date.now()+60000);
 for(let i=0;i<3;i++)expect((await roomRead(new NextRequest("http://localhost/api/number-rooms?code=AAAAAAAA"))).status).toBe(429);
 expect(database().prepare("SELECT COUNT(*) AS n FROM rate_limits").get()).toMatchObject({n:1});
});
it("cleans expired limiter/session rows and rejects forwarded chains and spoofed values",()=>{
 const db=database();db.prepare("INSERT INTO rate_limits VALUES(?,?,?)").run("expired",9,1);
 db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run("cleanup","cleanup_user","Cleanup","fixture",new Date().toISOString());
 db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run("expired-token","cleanup",1,new Date().toISOString());
 rateLimit("new",3,60000);expect(db.prepare("SELECT * FROM rate_limits WHERE bucket='expired'").get()).toBeUndefined();expect(db.prepare("SELECT * FROM sessions").all()).toHaveLength(0);
 const req=new NextRequest("http://localhost",{headers:{"x-forwarded-for":"192.0.2.1"}});expect(requestAddress(req)).toBe("direct");vi.stubEnv("TRUST_PROXY","true");expect(requestAddress(req)).toBe("192.0.2.1");
 for(const value of ["192.0.2.1, 192.0.2.2","spoofed", "192.0.2.1:123"]){req.headers.set("x-forwarded-for",value);expect(requestAddress(req)).toBe("unknown");}
});
it("keeps public deployments unhealthy until exact origin and trusted proxy configuration are supplied",()=>{
 const env={NODE_ENV:"production",NEXT_PUBLIC_SITE_URL:"https://puzzoria-demo.com"} as NodeJS.ProcessEnv;
 expect(deploymentReady(env)).toBe(false);expect(deploymentReady({...env,AUTH_ORIGIN:env.NEXT_PUBLIC_SITE_URL,TRUST_PROXY:"true"})).toBe(true);
 expect(deploymentReady({...env,AUTH_ORIGIN:"https://other-site.com",TRUST_PROXY:"true"})).toBe(false);
 expect(deploymentReady({NODE_ENV:"production",NEXT_PUBLIC_SITE_URL:"http://127.0.0.1:3030"})).toBe(true);
});
it("generates fresh overwritten nonces and blocks script eval and framing in production policies",()=>{
 const req=new NextRequest("http://localhost/fr",{headers:{"x-nonce":"attacker","content-security-policy":"script-src *"}});
 const a=proxy(req),b=proxy(req);expect(a.headers.get("content-security-policy")).not.toBe(b.headers.get("content-security-policy"));expect(a.headers.get("content-security-policy")).not.toContain("attacker");
 const csp=contentSecurityPolicy("fresh",false,true);expect(csp).toContain("frame-ancestors 'none'");expect(csp).toContain("'nonce-fresh'");expect(csp).not.toContain("unsafe-eval");expect(csp).toContain("upgrade-insecure-requests");expect(contentSecurityPolicy("fresh",true,false)).toContain("unsafe-eval");
});
