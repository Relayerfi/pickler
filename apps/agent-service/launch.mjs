import { spawn } from "node:child_process";
// Both children share the app environment and PostgreSQL database.
const mode = process.argv[2] === "start" ? "start" : "dev";
const children = [
  spawn(process.execPath, ["--import", "tsx", "src/workers/main.ts"], {
    stdio: "inherit",
    env: { ...process.env, MASTRA_TELEMETRY_DISABLED: "1" },
  }),
  spawn("mastra", [mode], {
    stdio: "inherit",
    env: { ...process.env, MASTRA_TELEMETRY_DISABLED: "1" },
  }),
];
let stopping = false;
function stop() {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) {
  child.on("error", () => {
    process.exitCode = 1;
    stop();
  });
  child.on("exit", (code) => {
    if (code) {
      process.exitCode = code;
    }
    stop();
  });
}
