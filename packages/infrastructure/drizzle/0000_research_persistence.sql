CREATE SCHEMA "pickler";
--> statement-breakpoint
CREATE TABLE "pickler"."agents" (
	"tenant_id" text NOT NULL,
	"id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"config" jsonb NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"schedule_enabled" boolean DEFAULT false NOT NULL,
	"next_due" bigint,
	CONSTRAINT "agents_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "positive_version" CHECK ("pickler"."agents"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "pickler"."agents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pickler"."events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pickler"."events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pickler"."metadata" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pickler"."metadata" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pickler"."runs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"request_key" text NOT NULL,
	"market_id" text,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"created_at" bigint NOT NULL,
	"started_at" bigint,
	"finished_at" bigint,
	"config_version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"decision" jsonb,
	"error" text,
	CONSTRAINT "run_status" CHECK ("pickler"."runs"."status" in ('queued','running','completed','failed','cancelled')),
	CONSTRAINT "run_trigger" CHECK ("pickler"."runs"."trigger" in ('manual','schedule'))
);
--> statement-breakpoint
ALTER TABLE "pickler"."runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pickler"."events" ADD CONSTRAINT "events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "pickler"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickler"."runs" ADD CONSTRAINT "runs_tenant_id_agent_id_agents_tenant_id_id_fk" FOREIGN KEY ("tenant_id","agent_id") REFERENCES "pickler"."agents"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_events" ON "pickler"."events" USING btree ("run_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "request_identity" ON "pickler"."runs" USING btree ("tenant_id","agent_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "one_running_agent" ON "pickler"."runs" USING btree ("tenant_id","agent_id") WHERE "pickler"."runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "quota" ON "pickler"."runs" USING btree ("tenant_id","agent_id","created_at");--> statement-breakpoint
CREATE INDEX "queued_jobs" ON "pickler"."runs" USING btree ("created_at","id") WHERE "pickler"."runs"."status" = 'queued';