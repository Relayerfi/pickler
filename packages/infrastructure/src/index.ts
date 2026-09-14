import type { Clock } from "@pickler/core";

export const systemClock: Clock = {
  now: () => new Date(),
};
