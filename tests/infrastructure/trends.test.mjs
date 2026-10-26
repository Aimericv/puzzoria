import test from 'node:test';
import assert from 'node:assert/strict';
import {collectTrends,parseGoogleRSS,parseTikTokHTML,TREND_SOURCES} from '../../scripts/autonomy-agent/trends.mjs';
test('public RSS is parsed as data without external entities or executable instructions',()=>{
 const data=parseGoogleRSS('<rss><channel><item><title><![CDATA[Wordle &amp; puzzles]]></title><ht:approx_traffic>20K+</ht:approx_traffic><pubDate>today</pubDate></item></channel></rss>');assert.equal(data[0].title,'Wordle & puzzles');assert.equal(data[0].reportedTraffic,'20K+');assert.throws(()=>parseGoogleRSS('<!DOCTYPE rss SYSTEM "file:///secret"><rss/>'));
});
test('TikTok requires actually returned public structured data',()=>{
 assert.throws(()=>parseTikTokHTML('<html>Login required</html>'),/no_public_structured_data/);
 assert.equal(parseTikTokHTML('<script id="__NEXT_DATA__" type="application/json">{"props":{"items":[{"hashtagName":"puzzlegame","viewCount":10}]}}</script>')[0].title,'puzzlegame');
});
test('denied public sources are unavailable with no login, redirects or paid fallback',async()=>{
 const called=[];const result=await collectTrends({fetchImpl:async(url,options)=>{called.push(url);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);return new Response('Denied',{status:403});}});
 assert.equal(result.status,'unavailable');assert.equal(called.length,TREND_SOURCES.length);assert.ok(result.sources.every(s=>s.status==='unavailable'&&s.items.length===0));
});
