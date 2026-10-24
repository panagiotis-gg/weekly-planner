-- J7: each live habit tick becomes one completion record before habit_checks is dropped.
-- Field clocks reuse the tick's "checked" clock so a later edit from a device still wins;
-- server_seq is kept as-is (pre-production: no device holds a cursor past these rows yet).
INSERT INTO "completions" ("id", "item_type", "item_id", "date", "planner_id", "server_seq", "field_clocks", "deleted")
SELECT
	gen_random_uuid(),
	'habit',
	hc."habit_id",
	hc."date",
	hc."planner_id",
	hc."server_seq",
	jsonb_build_object(
		'itemType', c.clock, 'itemId', c.clock, 'date', c.clock, 'deleted', c.clock
	),
	false
FROM "habit_checks" hc
CROSS JOIN LATERAL (
	SELECT COALESCE(hc."field_clocks"->>'checked', '0000000000000:0000:migration') AS clock
) c
WHERE hc."checked" AND NOT hc."deleted";--> statement-breakpoint
DROP TABLE "habit_checks" CASCADE;
