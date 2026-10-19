import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { generateChallenge } from "../src/lib/challenges.ts";
import { normalizeWord } from "../src/lib/word-normalization.ts";
import { utcDay } from "../src/lib/date.ts";

async function pool(items, concurrency, action) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; await action(items[index], index); }
  }));
}
export async function runLoadScenario(origin, players = 50) {
  // Callable only from our newly provisioned Docker smoke project, never an arbitrary live URL.
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || !Number.isInteger(players) || players < 2 || players > 100) throw new Error("Invalid isolated load configuration");
  const clients = Array.from({ length: players }, (_, index) => ({ index, cookies: new Map(), username: `load_${randomUUID().slice(0, 8)}`, password: randomUUID() + randomUUID() }));
  const requests = [], failures = [];
  async function api(client, endpoint, body, phase = "gameplay") {
    const started = performance.now();
    try {
      const response = await fetch(origin + endpoint, { method: body ? "POST" : "GET", signal: AbortSignal.timeout(15000), headers: {
        ...(body ? { "content-type": "application/json", origin } : {}),
        "user-agent": "Puzzoria load validation", cookie: [...client.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const line of response.headers.getSetCookie()) { const [pair] = line.split(";"), split = pair.indexOf("="); client.cookies.set(pair.slice(0, split), pair.slice(split + 1)); }
      const value = await response.json();
      requests.push({ phase, milliseconds: performance.now() - started, status: response.status });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return value;
    } catch { failures.push({ phase, endpoint: endpoint.split("?")[0] }); throw new Error("Isolated load request failed"); }
  }
  // Signups exercise scrypt without turning the test into an intentional memory/abuse flood.
  // The direct shared signup cap is 30/hour: signup at most 20; remaining players are guests.
  await pool(clients.slice(0, 20), 4, client => api(client, "/api/account", { action: "signup", username: client.username, password: client.password }, "authentication"));
  await pool(clients.slice(0, 5), 4, client => api(client, "/api/account", { action: "login", username: client.username, password: client.password }, "authentication"));
  const started = performance.now(), challenge = generateChallenge("word", "en", utcDay());
  await pool(clients, players, async client => {
    await api(client, "/api/measurement", { choice: "yes", events: [{ id: randomUUID(), name: "page_view", path: "/en/word", locale: "en" }] });
    for (let round = 0; round < 3; round++) {
      const run = await api(client, "/api/play", { action: "new", game: "word", locale: "en", mode: round === 0 ? "daily" : "practice" });
      const puzzle = round === 0 ? challenge : generateChallenge("word", "en", run.challenge.date, "easy", run.challenge.id.split(":")[2]);
      await api(client, "/api/play", { action: "start", runId: run.runId });
      const result = await api(client, "/api/play", { action: "submit", runId: run.runId, guesses: [normalizeWord(puzzle.answer)], hints: 0 });
      if (!result.completion?.success) throw new Error("Verified load result missing");
      await api(client, `/api/play?runId=${run.runId}`);
      if (client.index < 20) await api(client, "/api/account", { action: "sync", snapshots: [{ key: "dailygrid:preferences:load", value: { theme: "light" }, updatedAt: Date.now() }] });
    }
  });
  // Separate-device private rooms, manual choices and one verified higher/lower move.
  await pool(clients.filter((_, i) => i % 2 === 0 && i + 1 < clients.length), Math.min(10, players / 2), async host => {
    const guest = clients[host.index + 1];
    let room = await api(host, "/api/number-rooms", { action: "create", locale: "en" });
    room = await api(guest, "/api/number-rooms", { action: "join", code: room.code, locale: "en" });
    room = await api(host, "/api/number-rooms", { action: "play", code: room.code, sequence: room.sequence, step: { kind: "secret", value: 42 } });
    room = await api(guest, "/api/number-rooms", { action: "play", code: room.code, sequence: room.sequence, step: { kind: "secret", value: 73 } });
    await api(host, "/api/number-rooms", { action: "play", code: room.code, sequence: room.sequence, step: { kind: "try", value: 50 } });
    await api(guest, `/api/number-rooms?code=${room.code}`);
  });
  const percentile = (values, fraction) => values.sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)] ?? 0;
  const summarise = phase => {
    const group = requests.filter(r => r.phase === phase);
    return { requests: group.length, p50Milliseconds: Math.round(percentile(group.map(r => r.milliseconds), 0.5)), p95Milliseconds: Math.round(percentile(group.map(r => r.milliseconds), 0.95)), maxMilliseconds: Math.round(Math.max(0, ...group.map(r => r.milliseconds))) };
  };
  return { players, accounts: Math.min(players, 20), errors: failures.length, seconds: Math.round((performance.now() - started) / 1000), authentication: summarise("authentication"), gameplay: summarise("gameplay"), environment: "isolated local Docker; not a capacity guarantee for a VPS" };
}
