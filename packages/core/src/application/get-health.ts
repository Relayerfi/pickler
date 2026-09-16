import type { Clock } from "../ports/clock.js";

export function createGetHealth(clock: Clock) {
  return () => ({ status: "ok" as const, checkedAt: clock.now() });
}
