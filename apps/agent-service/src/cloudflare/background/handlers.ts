import type { ResearchRepository, RunRecord } from "@pickler/core";

export type BackgroundRepository = Pick<ResearchRepository, "recover" | "claim" | "tick"> & {
  acquireWorker(onLost: () => void): Promise<() => Promise<void>>;
  close(): Promise<void>;
};

export type WakeupQueue = { send(body: { kind: "research-wakeup" }): Promise<void> };

export async function consumeWakeup(
  repository: BackgroundRepository,
  execute: (run: RunRecord, signal: AbortSignal) => Promise<void>,
  queue: WakeupQueue,
  now = Date.now,
) {
  const controller = new AbortController();
  let release: (() => Promise<void>) | undefined;
  try {
    release = await repository.acquireWorker(() => controller.abort());
    await repository.recover(now());
    const run = await repository.claim(now());
    if (run) {
      await execute(run, controller.signal);
      // Drain one job per invocation; an extra no-op wakeup ends the chain.
      await queue.send({ kind: "research-wakeup" });
    }
  } finally {
    try {
      await release?.();
    } finally {
      await repository.close();
    }
  }
}

export async function reconcile(
  repository: BackgroundRepository,
  queue: WakeupQueue,
  now = Date.now,
) {
  try {
    await repository.tick(now());
    // Also recover interrupted work when no new scheduled job was created.
    await queue.send({ kind: "research-wakeup" });
  } finally {
    await repository.close();
  }
}
