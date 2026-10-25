ALTER TABLE "event_reminders" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "event_reminders" CASCADE;--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "time" time;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "time" time;--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD COLUMN "due_time" time;--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD CONSTRAINT "weekly_todos_due_date_in_week" CHECK ("weekly_todos"."due_date" IS NULL OR "weekly_todos"."due_date" BETWEEN "weekly_todos"."week_key" AND "weekly_todos"."week_key" + 6);--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD CONSTRAINT "weekly_todos_due_time_needs_date" CHECK ("weekly_todos"."due_time" IS NULL OR "weekly_todos"."due_date" IS NOT NULL);