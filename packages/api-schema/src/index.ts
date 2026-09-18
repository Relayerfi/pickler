// Public wire format only: no domain objects, secrets, Date or bigint.
export interface HealthResponse {
  status: "ok";
  checkedAt: string;
}

export * from "./research.js";

export * from "./paper.js";
