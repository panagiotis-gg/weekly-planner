CREATE TABLE "completions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_type" text NOT NULL,
	"item_id" uuid NOT NULL,
	"date" date NOT NULL,
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "completions_item_type" CHECK ("completions"."item_type" IN ('habit','weekly_todo','task'))
);
--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD COLUMN "target_type" text;--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD COLUMN "per_day" smallint;--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD COLUMN "days_per_week" smallint;--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD COLUMN "times_per_week" smallint;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "hide_when_achieved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "per_day" smallint;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "span_days" smallint;--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD COLUMN "target_type" text;--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD COLUMN "per_day" smallint;--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD COLUMN "days_per_week" smallint;--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD COLUMN "times_per_week" smallint;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "completions_item_date" ON "completions" USING btree ("item_id","date");--> statement-breakpoint
CREATE INDEX "completions_feed" ON "completions" USING btree ("planner_id","server_seq");--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD CONSTRAINT "habit_schedules_target_type" CHECK ("habit_schedules"."target_type" IN ('days_per_week','times_per_week','times_per_day','times_per_day_on_days'));--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD CONSTRAINT "habit_schedules_per_day" CHECK ("habit_schedules"."per_day" BETWEEN 1 AND 20);--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD CONSTRAINT "habit_schedules_days_per_week" CHECK ("habit_schedules"."days_per_week" BETWEEN 1 AND 7);--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD CONSTRAINT "habit_schedules_times_per_week" CHECK ("habit_schedules"."times_per_week" BETWEEN 1 AND 100);--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD CONSTRAINT "habit_schedules_target_fields" CHECK (("habit_schedules"."target_type" IS NULL AND "habit_schedules"."per_day" IS NULL AND "habit_schedules"."days_per_week" IS NULL AND "habit_schedules"."times_per_week" IS NULL)
     OR ("habit_schedules"."target_type" = 'days_per_week' AND "habit_schedules"."days_per_week" IS NOT NULL AND "habit_schedules"."per_day" IS NULL AND "habit_schedules"."times_per_week" IS NULL)
     OR ("habit_schedules"."target_type" = 'times_per_week' AND "habit_schedules"."times_per_week" IS NOT NULL AND "habit_schedules"."per_day" IS NULL AND "habit_schedules"."days_per_week" IS NULL)
     OR ("habit_schedules"."target_type" = 'times_per_day' AND "habit_schedules"."per_day" IS NOT NULL AND "habit_schedules"."days_per_week" IS NULL AND "habit_schedules"."times_per_week" IS NULL)
     OR ("habit_schedules"."target_type" = 'times_per_day_on_days' AND "habit_schedules"."per_day" IS NOT NULL AND "habit_schedules"."days_per_week" IS NOT NULL AND "habit_schedules"."times_per_week" IS NULL));--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD CONSTRAINT "habit_schedules_days_within_selection" CHECK ("habit_schedules"."days_per_week" IS NULL OR "habit_schedules"."days_per_week" <= bit_count(("habit_schedules"."weekdays")::int::bit(7)));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_per_day" CHECK ("tasks"."per_day" BETWEEN 1 AND 20);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_span_days" CHECK ("tasks"."span_days" BETWEEN 2 AND 31);--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD CONSTRAINT "weekly_todos_target_type" CHECK ("weekly_todos"."target_type" IN ('days_per_week','times_per_week','times_per_day','times_per_day_on_days'));--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD CONSTRAINT "weekly_todos_per_day" CHECK ("weekly_todos"."per_day" BETWEEN 1 AND 20);--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD CONSTRAINT "weekly_todos_days_per_week" CHECK ("weekly_todos"."days_per_week" BETWEEN 1 AND 7);--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD CONSTRAINT "weekly_todos_times_per_week" CHECK ("weekly_todos"."times_per_week" BETWEEN 1 AND 100);--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD CONSTRAINT "weekly_todos_target_fields" CHECK (("weekly_todos"."target_type" IS NULL AND "weekly_todos"."per_day" IS NULL AND "weekly_todos"."days_per_week" IS NULL AND "weekly_todos"."times_per_week" IS NULL)
     OR ("weekly_todos"."target_type" = 'days_per_week' AND "weekly_todos"."days_per_week" IS NOT NULL AND "weekly_todos"."per_day" IS NULL AND "weekly_todos"."times_per_week" IS NULL)
     OR ("weekly_todos"."target_type" = 'times_per_week' AND "weekly_todos"."times_per_week" IS NOT NULL AND "weekly_todos"."per_day" IS NULL AND "weekly_todos"."days_per_week" IS NULL)
     OR ("weekly_todos"."target_type" = 'times_per_day' AND "weekly_todos"."per_day" IS NOT NULL AND "weekly_todos"."days_per_week" IS NULL AND "weekly_todos"."times_per_week" IS NULL)
     OR ("weekly_todos"."target_type" = 'times_per_day_on_days' AND "weekly_todos"."per_day" IS NOT NULL AND "weekly_todos"."days_per_week" IS NOT NULL AND "weekly_todos"."times_per_week" IS NULL));