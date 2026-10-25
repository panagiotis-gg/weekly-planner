CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_type" text NOT NULL,
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"offset_minutes" integer NOT NULL,
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminders_item_type" CHECK ("reminders"."item_type" IN ('event','task','habit','weekly_todo')),
	CONSTRAINT "reminders_offset" CHECK ("reminders"."offset_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminders_item" ON "reminders" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "reminders_feed" ON "reminders" USING btree ("planner_id","server_seq");