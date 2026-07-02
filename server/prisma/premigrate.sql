-- Runs before `prisma db push` on every deploy (see the start script).
-- The VIDEO_WATCH room type was removed from the schema; Postgres can't drop
-- an enum variant while rows still reference it, so convert any legacy
-- watch-party rooms to plain video calls first. The ::text cast keeps this
-- safe on databases where the variant no longer exists.
UPDATE "Room" SET "type" = 'VIDEO_CALL' WHERE "type"::text = 'VIDEO_WATCH';
