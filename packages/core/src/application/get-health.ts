import type { Clock } from "../ports/clock";

export function createGetHealth(clock: Clock) {
  return () => ({ status: "ok" as const, checkedAt: clock.now() });
}
