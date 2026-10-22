# Bounded cloud proof

This pilot is authorized only to create the small UTC-window development task
under `agent/pilot/task/` and record its context under `agent/pilot/memory/`.
Read the repository's AGENTS.md and these files before working.

Session 1 implements `closedUtcDayWindow(now)` in `utc-window.mjs`: the previous
fully elapsed UTC day, with inclusive `from` and exclusive `to` ISO timestamps.
Add meaningful Node tests for month/year/leap-day and timezone boundaries and
invalid input. Run the tests, then write STATE.json and STATE.md with the
decision, verification, and the next session's task. Preserve the supplied
continuity nonce in STATE.json.

Session 2 must read that memory from GitHub in a NEW thread and runner. Extend
the helper with a validated positive-integer `days` argument (default 1) for a
window of fully elapsed UTC days. Add and run 7/30-day and invalid-window tests.
Record which first-session commit/context you resumed and finish the memory.

Use only the included model quota. No network, purchases, production changes,
merges, workflow changes, or credential access. Publication is performed by a
separate trusted step after your tools have stopped. This narrow proof is not
a permanent restriction on future product strategy.
