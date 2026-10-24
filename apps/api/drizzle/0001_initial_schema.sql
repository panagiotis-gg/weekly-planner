CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"email" "citext",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identities_provider_providerSubject_unique" UNIQUE("provider","provider_subject"),
	CONSTRAINT "auth_identities_provider" CHECK ("auth_identities"."provider" IN ('google','apple'))
);
--> statement-breakpoint
CREATE TABLE "email_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_tokens_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "email_tokens_purpose" CHECK ("email_tokens"."purpose" IN ('verify_email','reset_password'))
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"device_label" varchar(100),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "refresh_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"display_name" varchar(60),
	"is_admin" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"deletion_scheduled_for" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"email" "citext",
	"secret_hash" "bytea" NOT NULL,
	"role" text NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_secretHash_unique" UNIQUE("secret_hash"),
	CONSTRAINT "invitations_kind" CHECK ("invitations"."kind" IN ('email','code')),
	CONSTRAINT "invitations_role" CHECK ("invitations"."role" IN ('editor','viewer')),
	CONSTRAINT "invitations_email_kind" CHECK (("invitations"."kind" = 'email') = ("invitations"."email" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "planner_members" (
	"planner_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planner_members_planner_id_user_id_pk" PRIMARY KEY("planner_id","user_id"),
	CONSTRAINT "planner_members_role" CHECK ("planner_members"."role" IN ('owner','editor','viewer'))
);
--> statement-breakpoint
CREATE TABLE "planners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"personal_owner_id" uuid,
	"name" varchar(60),
	"week_start_day" smallint DEFAULT 1 NOT NULL,
	"day_colors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seq_counter" bigint DEFAULT 0 NOT NULL,
	"server_seq" bigint DEFAULT 0 NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planners_personalOwnerId_unique" UNIQUE("personal_owner_id"),
	CONSTRAINT "planners_kind" CHECK ("planners"."kind" IN ('personal','household')),
	CONSTRAINT "planners_week_start_day" CHECK ("planners"."week_start_day" IN (1,7)),
	CONSTRAINT "planners_personal_owner" CHECK (("planners"."kind" = 'personal') = ("planners"."personal_owner_id" IS NOT NULL)),
	CONSTRAINT "planners_household_name" CHECK ("planners"."kind" = 'personal' OR "planners"."name" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "day_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"focus" varchar(200),
	"note" varchar(10000),
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_entries_plannerId_date_unique" UNIQUE("planner_id","date")
);
--> statement-breakpoint
CREATE TABLE "event_exceptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"original_date" date NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"title" varchar(200),
	"date" date,
	"all_day" boolean,
	"start_time" time,
	"end_time" time,
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_exceptions_eventId_originalDate_unique" UNIQUE("event_id","original_date"),
	CONSTRAINT "event_exceptions_snapshot" CHECK ("event_exceptions"."cancelled" OR ("event_exceptions"."title" IS NOT NULL AND "event_exceptions"."date" IS NOT NULL AND "event_exceptions"."all_day" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "event_reminders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"offset_minutes" integer NOT NULL,
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_reminders_offset" CHECK ("event_reminders"."offset_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"start_date" date NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"start_time" time,
	"end_time" time,
	"recurrence_freq" text,
	"recurrence_weekdays" smallint,
	"recurrence_until" date,
	"recurrence_count" integer,
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_recurrence_freq" CHECK ("events"."recurrence_freq" IN ('daily','weekdays','weekly','monthly','yearly')),
	CONSTRAINT "events_recurrence_weekdays" CHECK ("events"."recurrence_weekdays" BETWEEN 1 AND 127),
	CONSTRAINT "events_recurrence_count" CHECK ("events"."recurrence_count" > 0),
	CONSTRAINT "events_all_day_times" CHECK ("events"."all_day" = ("events"."start_time" IS NULL)),
	CONSTRAINT "events_all_day_no_end" CHECK (NOT "events"."all_day" OR "events"."end_time" IS NULL),
	CONSTRAINT "events_end_after_start" CHECK ("events"."end_time" IS NULL OR "events"."end_time" > "events"."start_time"),
	CONSTRAINT "events_weekly_weekdays" CHECK (("events"."recurrence_freq" = 'weekly' AND "events"."recurrence_weekdays" IS NOT NULL) OR ("events"."recurrence_freq" IS DISTINCT FROM 'weekly' AND "events"."recurrence_weekdays" IS NULL)),
	CONSTRAINT "events_until_or_count" CHECK ("events"."recurrence_until" IS NULL OR "events"."recurrence_count" IS NULL),
	CONSTRAINT "events_end_needs_recurrence" CHECK ("events"."recurrence_freq" IS NOT NULL OR ("events"."recurrence_until" IS NULL AND "events"."recurrence_count" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "habit_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"habit_id" uuid NOT NULL,
	"date" date NOT NULL,
	"checked" boolean NOT NULL,
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habit_checks_habitId_date_unique" UNIQUE("habit_id","date")
);
--> statement-breakpoint
CREATE TABLE "habit_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"habit_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"weekdays" smallint NOT NULL,
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habit_schedules_habitId_effectiveFrom_unique" UNIQUE("habit_id","effective_from"),
	CONSTRAINT "habit_schedules_effective_from_monday" CHECK (extract(isodow FROM "habit_schedules"."effective_from") = 1),
	CONSTRAINT "habit_schedules_weekdays" CHECK ("habit_schedules"."weekdays" BETWEEN 1 AND 127)
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"position" text COLLATE "C" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habits_starts_on_monday" CHECK (extract(isodow FROM "habits"."starts_on") = 1),
	CONSTRAINT "habits_ends_on_monday" CHECK ("habits"."ends_on" IS NULL OR extract(isodow FROM "habits"."ends_on") = 1)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"title" varchar(200) NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" text COLLATE "C" NOT NULL,
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"week_key" date NOT NULL,
	"body" varchar(10000),
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "week_notes_plannerId_weekKey_unique" UNIQUE("planner_id","week_key"),
	CONSTRAINT "week_notes_week_key_monday" CHECK (extract(isodow FROM "week_notes"."week_key") = 1)
);
--> statement-breakpoint
CREATE TABLE "weekly_todos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"week_key" date NOT NULL,
	"title" varchar(200) NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" text COLLATE "C" NOT NULL,
	"planner_id" uuid NOT NULL,
	"server_seq" bigint NOT NULL,
	"field_clocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_todos_week_key_monday" CHECK (extract(isodow FROM "weekly_todos"."week_key") = 1)
);
--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_members" ADD CONSTRAINT "planner_members_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_members" ADD CONSTRAINT "planner_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planners" ADD CONSTRAINT "planners_personal_owner_id_users_id_fk" FOREIGN KEY ("personal_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_entries" ADD CONSTRAINT "day_entries_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_exceptions" ADD CONSTRAINT "event_exceptions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_exceptions" ADD CONSTRAINT "event_exceptions_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checks" ADD CONSTRAINT "habit_checks_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checks" ADD CONSTRAINT "habit_checks_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD CONSTRAINT "habit_schedules_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_schedules" ADD CONSTRAINT "habit_schedules_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_notes" ADD CONSTRAINT "week_notes_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_todos" ADD CONSTRAINT "weekly_todos_planner_id_planners_id_fk" FOREIGN KEY ("planner_id") REFERENCES "public"."planners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_identities_user" ON "auth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "users_deletion_due" ON "users" USING btree ("deletion_scheduled_for") WHERE "users"."deletion_scheduled_for" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "invitations_planner" ON "invitations" USING btree ("planner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planner_one_owner" ON "planner_members" USING btree ("planner_id") WHERE "planner_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "planner_members_user" ON "planner_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "day_entries_feed" ON "day_entries" USING btree ("planner_id","server_seq");--> statement-breakpoint
CREATE INDEX "event_exceptions_event" ON "event_exceptions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_exceptions_feed" ON "event_exceptions" USING btree ("planner_id","server_seq");--> statement-breakpoint
CREATE INDEX "event_reminders_event" ON "event_reminders" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_reminders_feed" ON "event_reminders" USING btree ("planner_id","server_seq");--> statement-breakpoint
CREATE INDEX "events_feed" ON "events" USING btree ("planner_id","server_seq");--> statement-breakpoint
CREATE INDEX "habit_checks_feed" ON "habit_checks" USING btree ("planner_id","server_seq");--> statement-breakpoint
CREATE INDEX "habit_schedules_habit" ON "habit_schedules" USING btree ("habit_id");--> statement-breakpoint
CREATE INDEX "habit_schedules_feed" ON "habit_schedules" USING btree ("planner_id","server_seq");--> statement-breakpoint
CREATE INDEX "habits_feed" ON "habits" USING btree ("planner_id","server_seq");--> statement-breakpoint
CREATE INDEX "tasks_feed" ON "tasks" USING btree ("planner_id","server_seq");--> statement-breakpoint
CREATE INDEX "week_notes_feed" ON "week_notes" USING btree ("planner_id","server_seq");--> statement-breakpoint
CREATE INDEX "weekly_todos_feed" ON "weekly_todos" USING btree ("planner_id","server_seq");