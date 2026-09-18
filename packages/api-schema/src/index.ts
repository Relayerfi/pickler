// Public wire format only: no domain objects, secrets, Date or bigint.
export interface HealthResponse {
  status: "ok";
  checkedAt: string;
}

export type * from "./landing";
export type * from "./waitlist";
export * from "./applications";
export type * from "./agents";
export type * from "./errors";
