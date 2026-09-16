import { setTimeout } from "node:timers/promises";
import { createContainer } from "../composition/container";

const container = await createContainer();
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
let releaseWorker: (() => Promise<void>) | undefined;
try {
  releaseWorker = await container.repository.acquireWorker(() => {
    process.exitCode = 1;
    controller.abort(new Error("Database worker ownership lost"));
  });
  await container.repository.recover(Date.now());
  console.log("Pickler worker ready. Only queued research can contact paid providers.");
  while (!controller.signal.aborted) {
    await container.repository.tick(Date.now());
    const run = await container.repository.claim(Date.now());
    if (run) {
      await container.execute(run, controller.signal);
    } else {
      await setTimeout(250, undefined, { signal: controller.signal }).catch(() => {});
    }
  }
} finally {
  try {
    await releaseWorker?.();
  } finally {
    await container.repository.close();
  }
}
