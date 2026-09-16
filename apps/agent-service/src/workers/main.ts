import { open, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { createContainer } from "../composition/container";

const container = await createContainer();
const lockPath = join(container.env.dataDir, "worker.lock");
async function acquire() {
  try {
    return await open(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
    const pid = Number(await readFile(lockPath, "utf8"));
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new Error("Worker lock is incomplete; inspect it before removing it");
    }
    try {
      process.kill(pid, 0);
    } catch (probe) {
      if ((probe as NodeJS.ErrnoException).code === "ESRCH") {
        await unlink(lockPath);
        return open(lockPath, "wx", 0o600);
      }
      throw probe;
    }
    throw new Error("Another local worker owns this data directory");
  }
}

const lock = await acquire();
await lock.writeFile(String(process.pid));
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
try {
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
  container.repository.close();
  await lock.close();
  await unlink(lockPath);
}
