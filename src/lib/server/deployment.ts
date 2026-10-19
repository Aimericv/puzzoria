import { isPublicSiteOrigin, resolveSiteOrigin } from "../site-origin";

export function deploymentReady(env: NodeJS.ProcessEnv = process.env) {
  if(env.NODE_ENV!=="production") return true;
  try {
    const origin=resolveSiteOrigin(env.NEXT_PUBLIC_SITE_URL);
    if(!isPublicSiteOrigin(origin)) return true;
    return env.AUTH_ORIGIN===origin && env.TRUST_PROXY==="true";
  } catch {return false;}
}
