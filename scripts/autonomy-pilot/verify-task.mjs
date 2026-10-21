import assert from "node:assert/strict";
const phase=Number(process.argv[2]);
const {closedUtcDayWindow}=await import("/opt/puzzoria-pilot/work/agent/pilot/task/utc-window.mjs");
assert.deepEqual(closedUtcDayWindow(new Date("2028-03-01T09:30:00Z")),{from:"2028-02-29T00:00:00.000Z",to:"2028-03-01T00:00:00.000Z"});
assert.deepEqual(closedUtcDayWindow(new Date("2027-01-01T01:00:00+02:00")),{from:"2026-12-30T00:00:00.000Z",to:"2026-12-31T00:00:00.000Z"});
assert.throws(()=>closedUtcDayWindow(new Date("invalid")));
if(phase===2) {
  assert.deepEqual(closedUtcDayWindow(new Date("2028-03-01T09:30:00Z"),7),{from:"2028-02-23T00:00:00.000Z",to:"2028-03-01T00:00:00.000Z"});
  assert.deepEqual(closedUtcDayWindow(new Date("2028-03-01T09:30:00Z"),30),{from:"2028-01-31T00:00:00.000Z",to:"2028-03-01T00:00:00.000Z"});
  for(const days of [0,-1,1.5,NaN,Infinity,"7"]) assert.throws(()=>closedUtcDayWindow(new Date(),days));
}
console.log("Independent task verification passed");
