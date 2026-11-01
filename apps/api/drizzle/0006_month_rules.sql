ALTER TABLE "events" DROP CONSTRAINT "events_recurrence_freq";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_interval_months" smallint;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_days_before_end" smallint;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "recurrence_weekend_day" smallint;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_recurrence_interval_months" CHECK ("events"."recurrence_interval_months" BETWEEN 1 AND 12);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_recurrence_days_before_end" CHECK ("events"."recurrence_days_before_end" BETWEEN 0 AND 27);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_recurrence_weekend_day" CHECK ("events"."recurrence_weekend_day" IN (6, 7));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_month_rules" CHECK ("events"."recurrence_freq" NOT IN ('month_end','first_weekend') OR ("events"."recurrence_until" IS NOT NULL AND "events"."recurrence_interval_months" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_recurrence_freq" CHECK ("events"."recurrence_freq" IN ('daily','weekdays','weekly','monthly','yearly','month_end','first_weekend'));