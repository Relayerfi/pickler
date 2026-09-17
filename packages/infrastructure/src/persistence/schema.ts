import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AgentConfig, Decision, RunRecord } from "@pickler/core";

export const pickler = pgSchema("pickler");
const milliseconds = (name: string) => bigint(name, { mode: "number" });

export const agents = pickler
  .table(
    "agents",
    {
      tenantId: text("tenant_id").notNull(),
      id: text("id").notNull(),
      version: integer("version").notNull().default(1),
      config: jsonb("config").$type<AgentConfig>().notNull(),
      paused: boolean("paused").notNull().default(false),
      scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
      nextDueAt: milliseconds("next_due"),
    },
    (t) => [
      primaryKey({ columns: [t.tenantId, t.id] }),
      check("positive_version", sql`${t.version} > 0`),
    ],
  )
  .enableRLS();

export const runs = pickler
  .table(
    "runs",
    {
      id: text("id").primaryKey(),
      tenantId: text("tenant_id").notNull(),
      agentId: text("agent_id").notNull(),
      requestKey: text("request_key").notNull(),
      marketId: text("market_id"),
      trigger: text("trigger").$type<RunRecord["trigger"]>().notNull(),
      status: text("status").$type<RunRecord["status"]>().notNull(),
      createdAt: milliseconds("created_at").notNull(),
      startedAt: milliseconds("started_at"),
      leaseOwner: text("lease_owner"),
      leaseExpiresAt: milliseconds("lease_expires_at"),
      finishedAt: milliseconds("finished_at"),
      configVersion: integer("config_version").notNull(),
      config: jsonb("config").$type<AgentConfig>().notNull(),
      decision: jsonb("decision").$type<Decision>(),
      error: text("error"),
    },
    (t) => [
      foreignKey({
        columns: [t.tenantId, t.agentId],
        foreignColumns: [agents.tenantId, agents.id],
      }),
      uniqueIndex("request_identity").on(t.tenantId, t.agentId, t.requestKey),
      uniqueIndex("one_running_agent")
        .on(t.tenantId, t.agentId)
        .where(sql`${t.status} = 'running'`),
      index("quota").on(t.tenantId, t.agentId, t.createdAt),
      index("queued_jobs")
        .on(t.createdAt, t.id)
        .where(sql`${t.status} = 'queued'`),
      check(
        "run_status",
        sql`${t.status} in ('queued','running','completed','failed','cancelled')`,
      ),
      index("expired_leases")
        .on(t.leaseExpiresAt)
        .where(sql`${t.status} = 'running'`),
      check(
        "running_requires_lease",
        sql`${t.status} <> 'running' OR (${t.leaseOwner} IS NOT NULL AND ${t.leaseExpiresAt} IS NOT NULL)`,
      ),
      check("run_trigger", sql`${t.trigger} in ('manual','schedule')`),
    ],
  )
  .enableRLS();

export const events = pickler
  .table(
    "events",
    {
      id: bigserial("id", { mode: "number" }).primaryKey(),
      runId: text("run_id")
        .notNull()
        .references(() => runs.id),
      type: text("type").notNull(),
      data: jsonb("data").$type<unknown>().notNull(),
      createdAt: milliseconds("created_at").notNull(),
    },
    (t) => [index("run_events").on(t.runId, t.id)],
  )
  .enableRLS();

export const metadata = pickler
  .table("metadata", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
  })
  .enableRLS();

export const executionPolicy = pickler
  .table(
    "execution_policy",
    {
      id: integer("id").primaryKey().default(1),
      globalLimit: integer("global_limit").notNull().default(5),
      tenantLimit: integer("tenant_limit").notNull().default(2),
    },
    (t) => [
      check("singleton_policy", sql`${t.id} = 1`),
      check(
        "valid_execution_limits",
        sql`${t.globalLimit} BETWEEN 1 AND 250 AND ${t.tenantLimit} BETWEEN 1 AND ${t.globalLimit}`,
      ),
    ],
  )
  .enableRLS();
