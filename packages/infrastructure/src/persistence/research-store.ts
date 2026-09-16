import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, asc, count, eq, gt, inArray, lte, sql } from "drizzle-orm";
import {
  DEFAULT_CONFIG,
  PilotError,
  assertConfig,
  assertCanQueue,
  assertCanSchedule,
  nextOccurrence,
  type AgentConfig,
  type AgentRecord,
  type Scope,
  type RunRecord,
  type Decision,
  type RunEvent,
  type ResearchRepository,
} from "@pickler/core";
import * as schema from "./schema.js";

const { agents, runs, events, metadata } = schema;
const DAY = 86_400_000;
type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const agentScope = (scope: Scope) =>
  and(eq(agents.tenantId, scope.tenantId), eq(agents.id, scope.agentId));
const runScope = (scope: Scope) =>
  and(eq(runs.tenantId, scope.tenantId), eq(runs.agentId, scope.agentId));

export class PostgresResearchStore implements ResearchRepository {
  readonly pool: Pool;
  readonly db: Database;
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
    this.pool.on("error", () => {
      console.error("PostgreSQL closed an idle pool connection; it will be replaced.");
    });
    this.db = drizzle(this.pool, { schema });
  }

  /** Migrations are explicit deployment steps; startup only seeds lab presets. */
  async init(): Promise<void> {
    await this.db
      .insert(agents)
      .values(
        ["alpha", "beta"].map((tenantId) => ({
          tenantId,
          id: `pickle-${tenantId}`,
          config: DEFAULT_CONFIG,
        })),
      )
      .onConflictDoNothing();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  /** Session-level ownership requires a direct connection or session pooler. */
  async acquireWorker(onLost: () => void): Promise<() => Promise<void>> {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_lock(761204, 1) AS acquired",
      );
      if (!result.rows[0]?.acquired) {
        throw new Error("Another worker owns this Pickler database");
      }
    } catch (error) {
      client.release(true);
      throw error;
    }
    client.on("error", onLost);
    client.on("end", onLost);
    return async () => {
      try {
        await client.query("SELECT pg_advisory_unlock(761204, 1)");
      } finally {
        client.removeListener("error", onLost);
        client.removeListener("end", onLost);
        client.release(true);
      }
    };
  }

  async bindConnectionIdentity(identity: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(761204, 2)`);
      const [previous] = await tx
        .select()
        .from(metadata)
        .where(eq(metadata.key, "connection_identity"));
      if (previous?.value === identity) {
        return;
      }
      await tx
        .insert(metadata)
        .values([
          { key: "connection_identity", value: identity },
          { key: "connections_checked", value: "false" },
        ])
        .onConflictDoUpdate({ target: metadata.key, set: { value: sql`excluded.value` } });
      await tx.update(agents).set({ scheduleEnabled: false, nextDueAt: null });
      await tx
        .update(runs)
        .set({ status: "cancelled", error: "CONNECTIONS_CHANGED" })
        .where(and(eq(runs.status, "queued"), eq(runs.trigger, "schedule")));
    });
  }

  async agents(tenantId: string): Promise<AgentRecord[]> {
    return this.db.select().from(agents).where(eq(agents.tenantId, tenantId)).orderBy(agents.id);
  }

  private async getAgent(
    scope: Scope,
    db: Database | Transaction = this.db,
    lock = false,
  ): Promise<AgentRecord> {
    const query = db.select().from(agents).where(agentScope(scope));
    const [agent] = await (lock ? query.for("update") : query);
    if (!agent) {
      throw new PilotError("NOT_FOUND", "Agent not found");
    }
    return agent;
  }

  agent(scope: Scope): Promise<AgentRecord> {
    return this.getAgent(scope);
  }

  async updateConfig(
    scope: Scope,
    expectedVersion: number,
    config: AgentConfig,
  ): Promise<AgentRecord> {
    assertConfig(config);
    return this.db.transaction(async (tx) => {
      const agent = await this.getAgent(scope, tx, true);
      if (agent.version !== expectedVersion) {
        throw new PilotError("CONFLICT", "Configuration version changed");
      }
      const [updated] = await tx
        .update(agents)
        .set({ config, version: agent.version + 1, scheduleEnabled: false, nextDueAt: null })
        .where(agentScope(scope))
        .returning();
      return updated!;
    });
  }

  async pause(scope: Scope, paused: boolean): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.getAgent(scope, tx, true);
      await tx.update(agents).set({ paused }).where(agentScope(scope));
      if (paused) {
        await tx
          .update(runs)
          .set({ status: "cancelled", error: "PAUSED" })
          .where(and(runScope(scope), eq(runs.status, "queued")));
      }
    });
  }

  async schedule(scope: Scope, enabled: boolean, now: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Same lock order as connection identity changes.
      await tx.execute(sql`select pg_advisory_xact_lock(761204, 2)`);
      const agent = await this.getAgent(scope, tx, true);
      if (enabled) {
        const [checked] = await tx
          .select()
          .from(metadata)
          .where(eq(metadata.key, "connections_checked"));
        const success = await tx
          .select({ id: runs.id })
          .from(runs)
          .where(
            and(
              runScope(scope),
              eq(runs.configVersion, agent.version),
              eq(runs.trigger, "manual"),
              eq(runs.status, "completed"),
            ),
          )
          .limit(1);
        assertCanSchedule(agent, checked?.value === "true", success.length > 0);
      }
      await tx
        .update(agents)
        .set({ scheduleEnabled: enabled, nextDueAt: enabled ? nextOccurrence(agent, now) : null })
        .where(agentScope(scope));
      if (!enabled) {
        await tx
          .update(runs)
          .set({ status: "cancelled", error: "SCHEDULE_DISABLED", finishedAt: now })
          .where(and(runScope(scope), eq(runs.status, "queued"), eq(runs.trigger, "schedule")));
      }
    });
  }

  /** Caller holds the agent row lock: admission and rolling quotas serialize per agent. */
  private async insertRun(
    tx: Transaction,
    agent: AgentRecord,
    key: string,
    marketId: string | null,
    now: number,
    trigger: RunRecord["trigger"],
  ): Promise<RunRecord> {
    const scope = { tenantId: agent.tenantId, agentId: agent.id };
    const [old] = await tx
      .select()
      .from(runs)
      .where(and(runScope(scope), eq(runs.requestKey, key)));
    if (old) {
      if (old.marketId !== marketId) {
        throw new PilotError("CONFLICT", "Idempotency key has a different payload");
      }
      return old;
    }
    const [usage] = await tx
      .select({ n: count() })
      .from(runs)
      .where(and(runScope(scope), gt(runs.createdAt, now - DAY)));
    assertCanQueue(agent, usage!.n);
    const [run] = await tx
      .insert(runs)
      .values({
        id: randomUUID(),
        ...scope,
        requestKey: key,
        marketId,
        trigger,
        status: "queued",
        createdAt: now,
        configVersion: agent.version,
        config: agent.config,
      })
      .returning();
    return run!;
  }

  async enqueue(
    scope: Scope,
    key: string,
    marketId: string | null,
    now: number,
  ): Promise<RunRecord> {
    if (!key || key.length > 128) {
      throw new PilotError("INVALID_INPUT", "Provide an idempotency key of at most 128 characters");
    }
    return this.db.transaction(async (tx) =>
      this.insertRun(tx, await this.getAgent(scope, tx, true), key, marketId, now, "manual"),
    );
  }

  async run(tenantId: string, runId: string): Promise<RunRecord> {
    const [run] = await this.db
      .select()
      .from(runs)
      .where(and(eq(runs.tenantId, tenantId), eq(runs.id, runId)));
    if (!run) {
      throw new PilotError("NOT_FOUND", "Run not found");
    }
    return run;
  }

  async events(tenantId: string, runId: string): Promise<RunEvent[]> {
    await this.run(tenantId, runId);
    return this.db
      .select({ id: events.id, type: events.type, data: events.data, createdAt: events.createdAt })
      .from(events)
      .where(eq(events.runId, runId))
      .orderBy(events.id);
  }

  async event(run: RunRecord, type: string, data: unknown, now: number): Promise<void> {
    await this.run(run.tenantId, run.id);
    await this.db
      .insert(events)
      .values({ runId: run.id, type, data: data ?? sql`'null'::jsonb`, createdAt: now });
  }

  async claim(now: number): Promise<RunRecord | null> {
    return this.db.transaction(async (tx) => {
      // Lock agents first, like admission/config/pause/tick; skip agents owned by other transactions.
      const candidates = await tx
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.paused, false),
            sql`exists (select 1 from ${runs} where ${runs.tenantId} = ${agents.tenantId} and ${runs.agentId} = ${agents.id} and ${runs.status} = 'queued')`,
          ),
        )
        .orderBy(agents.tenantId, agents.id)
        .for("update", { skipLocked: true });
      for (const agent of candidates) {
        const scope = { tenantId: agent.tenantId, agentId: agent.id };
        await tx
          .update(runs)
          .set({ status: "cancelled", error: "CONFIG_CHANGED", finishedAt: now })
          .where(
            and(
              runScope(scope),
              eq(runs.status, "queued"),
              sql`${runs.configVersion} <> ${agent.version}`,
            ),
          );
        const active = await tx
          .select({ id: runs.id })
          .from(runs)
          .where(and(runScope(scope), eq(runs.status, "running")))
          .limit(1);
        if (active.length) {
          continue;
        }
        const [next] = await tx
          .select()
          .from(runs)
          .where(and(runScope(scope), eq(runs.status, "queued")))
          .orderBy(asc(runs.createdAt), asc(runs.id))
          .limit(1);
        if (!next) {
          continue;
        }
        const [claimed] = await tx
          .update(runs)
          .set({ status: "running", startedAt: now })
          .where(eq(runs.id, next.id))
          .returning();
        return claimed!;
      }
      return null;
    });
  }

  async finish(
    run: RunRecord,
    decision: Decision | null,
    error: string | null,
    now: number,
  ): Promise<void> {
    await this.db
      .update(runs)
      .set({ status: error ? "failed" : "completed", decision, error, finishedAt: now })
      .where(and(eq(runs.id, run.id), eq(runs.tenantId, run.tenantId), eq(runs.status, "running")));
  }

  /** Only the worker holding the database-wide session lock may recover interrupted work. */
  async recover(now: number): Promise<void> {
    await this.db
      .update(runs)
      .set({ status: "failed", error: "INTERRUPTED", finishedAt: now })
      .where(eq(runs.status, "running"));
  }

  async tick(now: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      const due = await tx
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.scheduleEnabled, true),
            eq(agents.paused, false),
            lte(agents.nextDueAt, now),
          ),
        )
        .orderBy(agents.tenantId, agents.id)
        .for("update", { skipLocked: true });
      for (const agent of due) {
        const scope = { tenantId: agent.tenantId, agentId: agent.id };
        const active = await tx
          .select({ id: runs.id })
          .from(runs)
          .where(and(runScope(scope), inArray(runs.status, ["queued", "running"])))
          .limit(1);
        if (!active.length) {
          try {
            await this.insertRun(
              tx,
              agent,
              `schedule:${agent.version}:${agent.nextDueAt}`,
              null,
              now,
              "schedule",
            );
          } catch (error) {
            if (!(error instanceof PilotError && error.code === "QUOTA")) {
              throw error;
            }
          }
        }
        await tx
          .update(agents)
          .set({ nextDueAt: nextOccurrence(agent, now) })
          .where(agentScope(scope));
      }
    });
  }

  async setConnectionsChecked(ok: boolean): Promise<void> {
    await this.db
      .insert(metadata)
      .values({ key: "connections_checked", value: String(ok) })
      .onConflictDoUpdate({ target: metadata.key, set: { value: String(ok) } });
  }
}
