"use client";
import type { Completion } from "./types";
import { postJson } from "./play-client";
type Snapshot = { key: string; value: unknown; updatedAt: number };
export function snapshotBatches(
  snapshots: Snapshot[],
  maxBytes = 512000,
): Snapshot[][] {
  const groups: Snapshot[][] = [];
  let group: Snapshot[] = [],
    bytes = 0;
  const encoder = new TextEncoder();
  for (const snapshot of snapshots) {
    const size = encoder.encode(JSON.stringify(snapshot)).byteLength;
    if (group.length && (bytes + size > maxBytes || group.length === 100)) {
      groups.push(group);
      group = [];
      bytes = 0;
    }
    group.push(snapshot);
    bytes += size;
  }
  if (group.length) groups.push(group);
  return groups;
}
export async function migrateGuestProgress(progress: {
  completions: Completion[];
  snapshots: Snapshot[];
}) {
  let migrated = 0;
  // Always claim verified guest runs, even if there are no old local completions.
  for (
    let offset = 0;
    offset < Math.max(1, progress.completions.length);
    offset += 500
  ) {
    const result = await postJson("/api/account", {
      action: "migrate",
      summaryOnly: true,
      completions: progress.completions.slice(offset, offset + 500),
    });
    migrated += Number(result.migrated) || 0;
  }
  for (const batch of snapshotBatches(progress.snapshots))
    await postJson("/api/account", { action: "sync", snapshots: batch });
  return migrated;
}
