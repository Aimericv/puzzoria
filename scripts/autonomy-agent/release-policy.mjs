import ts from 'typescript';
import {createHash} from 'node:crypto';

export const COPY_FILES=new Set(['src/lib/seo-content.ts','src/lib/rare-word-seo.ts','src/lib/new-games-seo.ts','src/lib/social-seo.ts']);
export const E2E_PROJECTS=['desktop','mobile','android','iphone-webkit'];
function copyShape(source) {
  const file=ts.createSourceFile('copy.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  if(file.parseDiagnostics.length)throw Error('invalid_typescript');
  const positions=new Set(),values=[];
  function eligible(node) {
    let child=node,parent=node.parent;
    while(parent) {
      if(ts.isPropertyAssignment(parent)){if(parent.initializer!==child)return false;}
      else if(ts.isArrayLiteralExpression(parent)||ts.isObjectLiteralExpression(parent)) { /* Literal containers only. */ }
      else if(ts.isVariableDeclaration(parent))return parent.initializer===child&&ts.isIdentifier(parent.name)&&['content','titles','detail'].includes(parent.name.text);
      else return false;
      child=parent;parent=parent.parent;
    }
    return false;
  }
  function visit(node){if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&eligible(node)){positions.add(node.getStart(file));values.push(node.text);}ts.forEachChild(node,visit);}visit(file);
  // Keep comments too: adding @ts-ignore or changing code is not a copy edit.
  const scanner=ts.createScanner(ts.ScriptTarget.Latest,false,ts.LanguageVariant.Standard,source),tokens=[];
  for(let kind=scanner.scan();kind!==ts.SyntaxKind.EndOfFileToken;kind=scanner.scan()) {
    if([ts.SyntaxKind.WhitespaceTrivia,ts.SyntaxKind.NewLineTrivia].includes(kind))continue;
    tokens.push(positions.has(scanner.getTokenPos())?'__COPY_LITERAL__':scanner.getTokenText());
  }
  const transformed=ts.transform(file,[context=>root=>{
    function replace(node){if(positions.has(node.getStart(file)))return ts.factory.createStringLiteral('__COPY_LITERAL__');return ts.visitEachChild(node,replace,context);}
    return ts.visitNode(root,replace);
  }]);
  const printed=ts.createPrinter({removeComments:true}).printFile(transformed.transformed[0]);transformed.dispose();
  return {shape:printed+'\n'+tokens.join('\n'),values};
}
export function safeCopyEdit(before,after) {
  try {
    const a=copyShape(before),b=copyShape(after);
    return a.shape===b.shape&&a.values.length===b.values.length&&b.values.some((v,i)=>v!==a.values[i])&&
      b.values.every((value,i)=>value===a.values[i]||(value.trim().length>0&&value.length<=4000&&![...value].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)&&!/[<>]|https?:|javascript:|data:/i.test(value)&&!/[€$]|paypal|stripe|paiement|payment|purchase|payout/i.test(value)));
  }catch{return false;}
}
export function classifyRelease(files) {
  if(!Array.isArray(files)||files.length===0||files.length>30)return {risk:'manual',reason:'empty_or_large_change'};
  let runtime=false;
  for(const file of files) {
    if(file.mode&&file.mode!=='100644'||file.deleted||typeof file.after!=='string'||Buffer.byteLength(file.after)>262144)return {risk:'manual',reason:'deletion_link_or_large_file'};
    if(/^docs\/[a-zA-Z0-9/_-]+\.md$/.test(file.path)&&!/(?:AUTONOMY|CLOUD-HANDOFF|SECURITY|RETENTION|PREPRODUCTION|SEARCH-CONSOLE|ANALYTICS)/i.test(file.path))continue;
    if(!COPY_FILES.has(file.path)||typeof file.before!=='string'||!safeCopyEdit(file.before,file.after))return {risk:'manual',reason:`review_required:${file.path}`};
    runtime=true;
  }
  return {risk:'low',kind:runtime?'editorial-copy':'documentation',requiresDeployment:runtime,reason:'unchanged executable structure; bounded editorial literals only'};
}
export function policyDigest(policy) {return createHash('sha256').update(JSON.stringify(policy)).digest('hex');}
export function assertValidation(proof,{head,base,minimumUnitTests=345}) {
  if(!proof||proof.head!==head||proof.base!==base||proof.status!=='passed'||proof.network!=='none'||proof.credentials!==false||
    !['isolation','lint','typecheck','content','social','seo','build'].every(key=>proof.checks?.[key]===true)||
    !proof.unit||proof.unit.passed<minimumUnitTests||proof.unit.failed!==0||proof.unit.skipped!==0||
    !E2E_PROJECTS.every(project=>proof.e2e?.[project]?.passed>=1&&proof.e2e[project].failed===0&&proof.e2e[project].skipped===0&&proof.e2e[project].flaky===0))throw Error('Complete isolated validation for the exact head and main is required');
}
export function deploymentAllowed(control,enabled,policyHash) {
  const release=control.release;
  return enabled==='true'&&release?.productionEnabled===true&&
    Number.isFinite(Date.parse(release.productionAuthorization?.approvedAt))&&release.productionAuthorization?.policyHash===policyHash&&
    release.target?.origin==='https://puzzoria.com'&&typeof release.target?.sshHost==='string'&&/^[a-z0-9.-]+$/.test(release.target.sshHost)&&
    release.target?.sshUser==='puzzoria-release'&&Number.isInteger(release.target?.sshPort)&&release.target.sshPort>0&&release.target.sshPort<65536&&
    /^SHA256:[A-Za-z0-9+/]{43}$/.test(release.target?.hostKeyFingerprint??'')&&/^[a-f0-9]{40}$/.test(release.target?.initialCommit??'');
}
