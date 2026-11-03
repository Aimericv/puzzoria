import { initialKnowledge, normalizeAnswer, type KnowledgeChallenge, type KnowledgeState } from "./knowledge-types";

// Pure replay. The server additionally enforces sequence, ownership and quiz deadlines.
export function replayKnowledge(c: KnowledgeChallenge, input: unknown): KnowledgeState {
  if (!Array.isArray(input) || input.length > (c.kind === "football" ? 7 : 501)) throw new Error("invalid");
  const s = initialKnowledge();
  // Build the same first-match lookup once per authoritative replay. A 195-country
  // quiz must not repeatedly normalise every answer for every accepted action.
  const byAnswer=new Map<string,{id:string;answer:string}>(),foundIds=new Set<string>();
  if(c.kind==="quiz")for(const item of c.items)for(const value of [item.answer,...item.aliases]){const key=normalizeAnswer(value);if(!byAnswer.has(key))byAnswer.set(key,item);}
  for (const a of input) {
    if (s.completed || !a || typeof a !== "object") throw new Error("invalid");
    if (a.kind === "finish") {
      s.completed = true;
      s.actions.push({ kind: "finish" });
    } else if (a.kind === "answer" && typeof a.value === "string" && a.value.trim() && a.value.length <= 100 && normalizeAnswer(a.value)) {
      if (s.actions.length >= 500) throw new Error("invalid");
      const value = a.value.trim(), normalized = normalizeAnswer(value);
      s.actions.push({ kind: "answer", value });
      if (c.kind === "quiz") {
        const item = byAnswer.get(normalized);
        s.feedback = !item ? "unknown" : foundIds.has(item.id) ? "duplicate" : "correct";
        if (item && s.feedback === "correct") {s.found.push({ id: item.id, answer: item.answer });foundIds.add(item.id);}
        s.success = s.found.length === c.items.length;
        s.completed = s.success;
        s.score = Math.round(s.found.length * 1000 / c.items.length);
      } else {
        if (s.guesses.some(g => normalizeAnswer(g) === normalized)) throw new Error("duplicate");
        s.guesses.push(value);
        s.success = [c.answer, ...c.aliases].some(v => normalizeAnswer(v) === normalized);
        s.feedback = s.success ? "correct" : "unknown";
        s.completed = s.success || s.guesses.length >= c.attempts;
        s.score = s.success ? (c.attempts + 1 - s.guesses.length) * 100 : 0;
      }
    } else throw new Error("invalid");
    s.sequence++;
  }
  if (s.completed) {
    if (c.kind === "quiz") s.reveal = c.items.map(i => ({ id: i.id, answer: i.answer }));
    else { s.answer = c.answer; s.sources = c.sources; }
  }
  return s;
}
