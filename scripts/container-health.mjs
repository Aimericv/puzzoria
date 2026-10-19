import { get } from "node:http";
const request = get({ hostname: "127.0.0.1", port: process.env.PORT ?? 3000, path: "/api/health", timeout: 4000 }, (response) => {
  response.resume();
  if (response.statusCode !== 200) process.exitCode = 1;
});
request.on("timeout", () => request.destroy(new Error("Health timeout")));
request.on("error", () => { process.exitCode = 1; });
