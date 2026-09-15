import { createClient, type InStatement, type Client, type Transaction, type Row } from '@libsql/client';
import { setTimeout } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { DEFAULT_CONFIG, PilotError, assertConfig, assertCanQueue, assertCanSchedule, nextOccurrence, type AgentConfig, type AgentRecord, type Scope, type RunRecord, type Decision, type RunEvent, type ResearchRepository } from '@pickler/core';

const DAY = 86_400_000;
const decodeAgent = (row: Row): AgentRecord => ({
  id: String(row.id), tenantId: String(row.tenant_id), version: Number(row.version), config: JSON.parse(String(row.config)) as AgentConfig,
  paused: Boolean(row.paused), scheduleEnabled: Boolean(row.schedule_enabled), nextDueAt: row.next_due === null ? null : Number(row.next_due),
});
const decodeRun = (row: Row): RunRecord => ({
  id: String(row.id), tenantId: String(row.tenant_id), agentId: String(row.agent_id),
  status: String(row.status) as RunRecord['status'], trigger: String(row.trigger) as RunRecord['trigger'],
  marketId: row.market_id === null ? null : String(row.market_id), createdAt: Number(row.created_at),
  startedAt: row.started_at === null ? null : Number(row.started_at), finishedAt: row.finished_at === null ? null : Number(row.finished_at),
  configVersion: Number(row.config_version), config: JSON.parse(String(row.config)) as AgentConfig,
  decision: row.decision === null ? null : JSON.parse(String(row.decision)) as Decision, error: row.error === null ? null : String(row.error),
});
export class SqliteResearchStore implements ResearchRepository {
  readonly client: Client;
  constructor(url: string) { this.client = createClient({ url }); }
  private async retryBusy<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await operation(); }
      catch (error) {
        if (attempt >= 40 || !['SQLITE_BUSY', 'SQLITE_LOCKED'].includes(String((error as { code?: string }).code))) throw error;
        await setTimeout(25);
      }
    }
  }
  private begin() { return this.retryBusy(() => this.client.transaction('write')); }
  private exec(input: InStatement) { return this.retryBusy(() => this.client.execute(input)); }
  async bindConnectionIdentity(identity: string): Promise<void> {
    const tx = await this.begin();
    try {
      const previous = (await tx.execute("SELECT value FROM metadata WHERE key='connection_identity'")).rows[0]?.value;
      if (previous !== identity) {
        await tx.execute("INSERT INTO metadata(key,value) VALUES('connections_checked','false') ON CONFLICT(key) DO UPDATE SET value='false'");
        await tx.execute({ sql: "INSERT INTO metadata(key,value) VALUES('connection_identity',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", args: [identity] });
        await tx.execute('UPDATE agents SET schedule_enabled=0,next_due=NULL');
        await tx.execute("UPDATE runs SET status='cancelled',error='CONNECTIONS_CHANGED' WHERE status='queued' AND trigger='schedule'");
      }
      await tx.commit();
    } finally { tx.close(); }
  }
  async init(): Promise<void> {
    await this.retryBusy(() => this.client.executeMultiple(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS agents (
        tenant_id TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL, config TEXT NOT NULL,
        paused INTEGER NOT NULL DEFAULT 0, schedule_enabled INTEGER NOT NULL DEFAULT 0, next_due INTEGER,
        PRIMARY KEY (tenant_id,id));
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL, request_key TEXT NOT NULL,
        market_id TEXT, trigger TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL,
        started_at INTEGER, finished_at INTEGER, config_version INTEGER NOT NULL, config TEXT NOT NULL, decision TEXT, error TEXT,
        UNIQUE(tenant_id,agent_id,request_key), FOREIGN KEY(tenant_id,agent_id) REFERENCES agents(tenant_id,id));
      CREATE UNIQUE INDEX IF NOT EXISTS one_running_agent ON runs(tenant_id,agent_id) WHERE status='running';
      CREATE INDEX IF NOT EXISTS quota ON runs(tenant_id,agent_id,created_at);
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), type TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `));
    for (const tenant of ['alpha', 'beta']) await this.exec({
      sql: 'INSERT OR IGNORE INTO agents(tenant_id,id,version,config) VALUES(?,?,1,?)',
      args: [tenant, `pickle-${tenant}`, JSON.stringify(DEFAULT_CONFIG)],
    });
  }
  close(): void { this.client.close(); }
  async agents(tenantId: string): Promise<AgentRecord[]> {
    return (await this.exec({ sql: 'SELECT * FROM agents WHERE tenant_id=? ORDER BY id', args: [tenantId] })).rows.map(decodeAgent);
  }
  private async getAgent(scope: Scope, db: Client | Transaction = this.client): Promise<AgentRecord> {
    const row = (await db.execute({ sql: 'SELECT * FROM agents WHERE tenant_id=? AND id=?', args: [scope.tenantId, scope.agentId] })).rows[0];
    if (!row) throw new PilotError('NOT_FOUND', 'Agent not found'); return decodeAgent(row);
  }
  agent(scope: Scope): Promise<AgentRecord> { return this.getAgent(scope); }
  async updateConfig(scope: Scope, expectedVersion: number, config: AgentConfig): Promise<AgentRecord> {
    assertConfig(config);
    await this.agent(scope);
    const result = await this.exec({
      sql: 'UPDATE agents SET config=?,version=version+1,schedule_enabled=0,next_due=NULL WHERE tenant_id=? AND id=? AND version=?',
      args: [JSON.stringify(config), scope.tenantId, scope.agentId, expectedVersion],
    });
    if (!result.rowsAffected) throw new PilotError('CONFLICT', 'Configuration version changed');
    return this.agent(scope);
  }
  async pause(scope: Scope, paused: boolean): Promise<void> {
    const tx = await this.begin();
    try {
      await this.getAgent(scope, tx);
      await tx.execute({ sql: 'UPDATE agents SET paused=? WHERE tenant_id=? AND id=?', args: [Number(paused), scope.tenantId, scope.agentId] });
      if (paused) await tx.execute({ sql: "UPDATE runs SET status='cancelled',error='PAUSED' WHERE tenant_id=? AND agent_id=? AND status='queued'", args: [scope.tenantId, scope.agentId] });
      await tx.commit();
    } finally { tx.close(); }
  }
  async schedule(scope: Scope, enabled: boolean, now: number): Promise<void> {
    const tx = await this.begin();
    try {
      const agent = await this.getAgent(scope, tx);
      if (enabled) {
        const checked = (await tx.execute("SELECT value FROM metadata WHERE key='connections_checked'")).rows[0]?.value === 'true';
        const success = (await tx.execute({ sql: "SELECT id FROM runs WHERE tenant_id=? AND agent_id=? AND config_version=? AND trigger='manual' AND status='completed' LIMIT 1", args: [scope.tenantId, scope.agentId, agent.version] })).rows.length > 0;
        assertCanSchedule(agent, checked, success);
      }
      await tx.execute({ sql: 'UPDATE agents SET schedule_enabled=?,next_due=? WHERE tenant_id=? AND id=?', args: [Number(enabled), enabled ? nextOccurrence(agent, now) : null, scope.tenantId, scope.agentId] });
      if (!enabled) await tx.execute({ sql: "UPDATE runs SET status='cancelled',error='SCHEDULE_DISABLED',finished_at=? WHERE tenant_id=? AND agent_id=? AND status='queued' AND trigger='schedule'", args: [now, scope.tenantId, scope.agentId] });
      await tx.commit();
    } finally { tx.close(); }
  }
  private async insertRun(tx: Transaction, agent: AgentRecord, key: string, marketId: string | null, now: number, trigger: RunRecord['trigger']): Promise<RunRecord> {
    const old = (await tx.execute({ sql: 'SELECT * FROM runs WHERE tenant_id=? AND agent_id=? AND request_key=?', args: [agent.tenantId, agent.id, key] })).rows[0];
    if (old) {
      const run = decodeRun(old);
      if (run.marketId !== marketId) throw new PilotError('CONFLICT', 'Idempotency key has a different payload');
      return run;
    }
    const count = Number((await tx.execute({ sql: 'SELECT COUNT(*) AS n FROM runs WHERE tenant_id=? AND agent_id=? AND created_at>?', args: [agent.tenantId, agent.id, now - DAY] })).rows[0]?.n);
    assertCanQueue(agent, count);
    const id = randomUUID();
    await tx.execute({ sql: "INSERT INTO runs(id,tenant_id,agent_id,request_key,market_id,trigger,status,created_at,config_version,config) VALUES(?,?,?,?,?,?,'queued',?,?,?)", args: [id, agent.tenantId, agent.id, key, marketId, trigger, now, agent.version, JSON.stringify(agent.config)] });
    return decodeRun((await tx.execute({ sql: 'SELECT * FROM runs WHERE id=?', args: [id] })).rows[0]!);
  }
  async enqueue(scope: Scope, key: string, marketId: string | null, now: number): Promise<RunRecord> {
    if (!key || key.length > 128) throw new PilotError('INVALID_INPUT', 'Provide an idempotency key of at most 128 characters');
    const tx = await this.begin();
    try { const run = await this.insertRun(tx, await this.getAgent(scope, tx), key, marketId, now, 'manual'); await tx.commit(); return run; }
    finally { tx.close(); }
  }
  async run(tenantId: string, runId: string): Promise<RunRecord> {
    const row = (await this.exec({ sql: 'SELECT * FROM runs WHERE tenant_id=? AND id=?', args: [tenantId, runId] })).rows[0];
    if (!row) throw new PilotError('NOT_FOUND', 'Run not found'); return decodeRun(row);
  }
  async events(tenantId: string, runId: string): Promise<RunEvent[]> {
    await this.run(tenantId, runId);
    return (await this.exec({ sql: 'SELECT * FROM events WHERE run_id=? ORDER BY id', args: [runId] })).rows.map(r => ({ id: Number(r.id), type: String(r.type), data: JSON.parse(String(r.data)) as unknown, createdAt: Number(r.created_at) }));
  }
  async event(run: RunRecord, type: string, data: unknown, now: number): Promise<void> {
    await this.run(run.tenantId, run.id);
    await this.exec({ sql: 'INSERT INTO events(run_id,type,data,created_at) VALUES(?,?,?,?)', args: [run.id, type, JSON.stringify(data) ?? 'null', now] });
  }
  async claim(now: number): Promise<RunRecord | null> {
    const tx = await this.begin();
    try {
      await tx.execute({ sql: "UPDATE runs SET status='cancelled',error='CONFIG_CHANGED',finished_at=? WHERE status='queued' AND EXISTS(SELECT 1 FROM agents a WHERE a.tenant_id=runs.tenant_id AND a.id=runs.agent_id AND a.version<>runs.config_version)", args: [now] });
      const row = (await tx.execute(`SELECT r.* FROM runs r JOIN agents a ON a.tenant_id=r.tenant_id AND a.id=r.agent_id
        WHERE r.status='queued' AND a.paused=0 AND NOT EXISTS(SELECT 1 FROM runs x WHERE x.tenant_id=r.tenant_id AND x.agent_id=r.agent_id AND x.status='running') ORDER BY r.created_at LIMIT 1`)).rows[0];
      if (!row) { await tx.commit(); return null; }
      await tx.execute({ sql: "UPDATE runs SET status='running',started_at=? WHERE id=?", args: [now, String(row.id)] });
      await tx.commit(); return { ...decodeRun(row), status: 'running', startedAt: now };
    } finally { tx.close(); }
  }
  async finish(run: RunRecord, decision: Decision | null, error: string | null, now: number): Promise<void> {
    await this.exec({ sql: "UPDATE runs SET status=?,decision=?,error=?,finished_at=? WHERE id=? AND tenant_id=? AND status='running'", args: [error ? 'failed' : 'completed', decision ? JSON.stringify(decision) : null, error, now, run.id, run.tenantId] });
  }
  async recover(now: number): Promise<void> {
    await this.exec({ sql: "UPDATE runs SET status='failed',error='INTERRUPTED',finished_at=? WHERE status='running'", args: [now] });
  }
  async tick(now: number): Promise<void> {
    const tx = await this.begin();
    try {
      const due = (await tx.execute({ sql: 'SELECT * FROM agents WHERE schedule_enabled=1 AND paused=0 AND next_due<=?', args: [now] })).rows;
      for (const row of due) {
        const agent = decodeAgent(row);
        const active = (await tx.execute({ sql: "SELECT id FROM runs WHERE tenant_id=? AND agent_id=? AND status IN ('queued','running') LIMIT 1", args: [agent.tenantId, agent.id] })).rows.length;
        if (!active) {
          try { await this.insertRun(tx, agent, `schedule:${agent.version}:${agent.nextDueAt}`, null, now, 'schedule'); }
          catch (error) { if (!(error instanceof PilotError && error.code === 'QUOTA')) throw error; }
        }
        await tx.execute({ sql: 'UPDATE agents SET next_due=? WHERE tenant_id=? AND id=?', args: [nextOccurrence(agent, now), agent.tenantId, agent.id] });
      }
      await tx.commit();
    } finally { tx.close(); }
  }
  async setConnectionsChecked(ok: boolean): Promise<void> {
    await this.exec({ sql: "INSERT INTO metadata(key,value) VALUES('connections_checked',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", args: [String(ok)] });
  }
}
