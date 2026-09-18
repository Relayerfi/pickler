import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createBudgetLedger } from "@pickler/core";
import {
  createSqlLedgerStore,
  migrateLedger,
  type SqlExec,
} from "../src/budget/sql-ledger-store.js";

/** Adapts node:sqlite to the SqlStorage.exec(...).toArray() shape Durable Objects expose. */
function sqlite(): SqlExec & { transaction<T>(fn: () => T): T } {
  const db = new DatabaseSync(":memory:");
  return {
    exec(query, ...bindings) {
      const statement = db.prepare(query);
      const isRead = /^\s*SELECT/i.test(query);
      return {
        toArray: () =>
          isRead
            ? (statement.all(...bindings) as Record<string, unknown>[])
            : (statement.run(...bindings), []),
      };
    },
    transaction(fn) {
      db.exec("BEGIN");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

test("the SQLite store round-trips bigint amounts, reservations, dedupe keys and status", () => {
  const sql = sqlite();
  migrateLedger(sql);
  migrateLedger(sql); // idempotent
  const store = createSqlLedgerStore(sql);
  const now = new Date("2026-09-16T12:00:00Z");
  const huge = 9_000_000_000_000_000_001n; // beyond Number.MAX_SAFE_INTEGER

  store.putCategory({
    category: "payments",
    limit: huge,
    spent: 5n,
    reserved: 7n,
    periodKey: "2026-09",
  });
  assert.deepEqual(store.getCategory("payments"), {
    category: "payments",
    limit: huge,
    spent: 5n,
    reserved: 7n,
    periodKey: "2026-09",
  });
  assert.equal(store.getCategory("tokens"), null);

  store.putReservation({
    id: "r1",
    category: "payments",
    amount: 7n,
    state: "held",
    source: "x402",
    sourceRef: null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 1000),
  });
  store.putReservation({
    id: "r1",
    category: "payments",
    amount: 7n,
    state: "committed",
    source: "x402",
    sourceRef: null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 1000),
  });
  assert.equal(store.getReservation("r1")?.state, "committed");
  assert.equal(store.heldReservations().length, 0);

  assert.equal(store.markProcessed("record:e1", now), true);
  assert.equal(store.markProcessed("record:e1", now), false);
  assert.equal(store.getStatus(), null);
  store.setStatus("paused");
  store.setStatus("killed");
  assert.equal(store.getStatus(), "killed");
});

test("the ledger on SQLite rolls back a failed operation", () => {
  const sql = sqlite();
  migrateLedger(sql);
  const ledger = createBudgetLedger(
    createSqlLedgerStore(sql),
    () => new Date("2026-09-16T12:00:00Z"),
  );
  sql.transaction(() =>
    ledger.hydrate([{ category: "payments", limit: "100", spent: "0" }], "active"),
  );
  sql.transaction(() =>
    ledger.reserve({
      reservationId: "a",
      category: "payments",
      amount: "60",
      source: "t",
      ttlMs: 60_000,
    }),
  );
  assert.throws(() =>
    sql.transaction(() =>
      ledger.reserve({
        reservationId: "a",
        category: "payments",
        amount: "61",
        source: "t",
        ttlMs: 60_000,
      }),
    ),
  );
  const payments = ledger.snapshot().categories.find((c) => c.category === "payments")!;
  assert.deepEqual([payments.reserved, payments.spent], [60n, 0n]);
  assert.equal(
    sql.transaction(() =>
      ledger.reserve({
        reservationId: "b",
        category: "payments",
        amount: "41",
        source: "t",
        ttlMs: 60_000,
      }),
    ).success,
    false,
  );
});
