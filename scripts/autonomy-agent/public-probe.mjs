export async function probePublicSite(origin,{fetchImpl=fetch}={}) {
  if(origin!=='https://puzzoria.com')throw Error('Only the configured Puzzoria production origin is permitted');
  const get=async path=>{const response=await fetchImpl(origin+path,{redirect:'error',signal:AbortSignal.timeout(10000)});if(response.status!==200)throw Error('Public endpoint failed');return response;};
  if((await (await get('/api/health')).json()).status!=='ok')throw Error('Public health check failed');
  for(const locale of ['en','fr','es','de']) {
    const response=await get('/'+locale),html=await response.text();
    if(html.length>2097152||!/<title>[^<]+<\/title>/i.test(html)||!html.includes(origin+'/'+locale)||
      !/private/i.test(response.headers.get('cache-control')??'')||!/no-store/i.test(response.headers.get('cache-control')??'')||
      !/nonce-/i.test(response.headers.get('content-security-policy')??'')||/script-src[^;]*unsafe-(?:inline|eval)/i.test(response.headers.get('content-security-policy')??'')||
      /noindex/i.test(response.headers.get('x-robots-tag')??'')||/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html))throw Error('Public page or security regression');
  }
  const robots=await (await get('/robots.txt')).text(),sitemap=await (await get('/sitemap.xml')).text();
  if(/Disallow:\s*\/\s*$/im.test(robots)||!robots.includes(origin+'/sitemap.xml')||!sitemap.includes(origin))throw Error('SEO publication check failed');
  return {status:'passed',locales:4};
}
