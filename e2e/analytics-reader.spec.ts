import {test,expect} from "@playwright/test";

test("agent capability reads aggregates without gaining account/admin or write access",async({request})=>{
  const endpoint="/api/agent/analytics?days=7";
  expect((await request.get(endpoint)).status()).toBe(401);
  expect((await request.get(`${endpoint}&token=${"e".repeat(43)}`)).status()).toBe(401);
  const headers={Authorization:`Bearer ${"e".repeat(43)}`};
  const response=await request.get(endpoint,{headers});expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  // Next adds its own RSC cache dimensions to the route's private auth variant.
  expect(response.headers()["vary"].split(",").map(value=>value.trim().toLowerCase())).toContain("authorization");
  expect(response.headers()["set-cookie"]).toBeUndefined();
  const report=await response.json();expect(report).toMatchObject({schema:"puzzoria.analytics",schemaVersion:1,timezone:"UTC",filters:{days:7}});
  expect(report.report).toHaveProperty("official");expect(report.report).toHaveProperty("product");
  expect(JSON.stringify(report)).not.toContain("e".repeat(43));
  expect((await request.post("/api/agent/analytics",{headers,data:{action:"delete"}})).status()).toBe(405);
  expect((await request.get("/api/admin/analytics",{headers})).status()).toBe(403);
});
