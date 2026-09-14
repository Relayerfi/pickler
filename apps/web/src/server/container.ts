import "server-only";
import { createGetHealth } from "@pickler/core";
import { systemClock } from "@pickler/infrastructure";

// Composition root: wire concrete adapters here, not inside business logic.
export const services = {
  getHealth: createGetHealth(systemClock),
};
