// Driver methods run trusted, installed host operations. This state machine is
// also exercised with a disposable SQLite database; it never restores that
// backup automatically, so writes made after rollout survive an image rollback.
export async function recoverDeployment({driver,store}) {
  const state=await store.read();
  if(!state||!['switching','checking','rolling_back'].includes(state.phase))return state;
  await store.write({...state,phase:'rolling_back'});
  try {
    if(await driver.schema()!==state.schema){await driver.haltWrites?.();throw Error('Database schema changed; operator recovery required');}
    await driver.switchImage(state.previousImage);
    await driver.probe(state.previousImage);
    const result={...state,phase:'rolled_back',currentImage:state.previousImage,finishedAt:new Date().toISOString()};await store.write(result);return result;
  } catch(error){await store.write({...state,phase:'manual_intervention',reason:error.message});throw error;}
}
export async function deployTransaction({driver,store,sha,expected,now=()=>new Date().toISOString()}) {
  if(!/^[a-f0-9]{40}$/.test(sha??'')||!/^[a-f0-9]{40}$/.test(expected??''))throw Error('Exact release and previous commit are required');
  const previous=await store.read();
  if(previous?.phase==='manual_intervention')throw Error('Operator recovery is required');
  if(previous?.phase==='healthy'&&previous.sha===sha)return previous;
  if(previous&&['switching','checking','rolling_back'].includes(previous.phase))throw Error('Recover the interrupted rollout before another release');
  if(previous?.currentCommit!==expected)throw Error('Production changed since the release was authorized');
  const previousImage=await driver.currentImage();
  if(previous.currentImage&&previous.currentImage!==previousImage)throw Error('Production image changed outside the release controller');
  const schema=await driver.schema();
  const image=await driver.prepare(sha,expected);
  const backup=await driver.backupAndVerify();
  if(!backup?.verified)throw Error('A verified restorable backup is required before switching');
  await driver.preview?.(image,backup,schema);
  if(await driver.currentImage()!==previousImage||await driver.schema()!==schema)throw Error('Production changed during preparation');
  let state={sha,previousCommit:expected,currentCommit:expected,previousImage,candidateImage:image,schema,backup,startedAt:now(),phase:'switching'};
  await store.write(state); // Durable before the first production mutation.
  try {
    await driver.switchImage(image);state={...state,phase:'checking'};await store.write(state);
    await driver.probe(image);
    if(await driver.schema()!==schema)throw Error('Unexpected database schema change');
    state={...state,phase:'healthy',currentCommit:sha,currentImage:image,releasedAt:now(),finishedAt:now()};await store.write(state);return state;
  }catch(error){const result=await recoverDeployment({driver,store});return {...result,failure:error.message};}
}
