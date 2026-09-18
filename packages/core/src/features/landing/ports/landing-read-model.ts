import type { LandingSnapshot } from "../domain/landing";

export interface LandingReadModel {
  /** Rejects with DataSourceUnavailableError when the source cannot answer. */
  getSnapshot(): Promise<LandingSnapshot>;
}
