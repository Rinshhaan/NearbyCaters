ALTER TABLE "events" ADD COLUMN "reservedSlots" INTEGER NOT NULL DEFAULT 0;

UPDATE "events"
SET "reservedSlots" = (
  SELECT COUNT(*)
  FROM "bookings"
  WHERE "bookings"."eventId" = "events"."id"
    AND "bookings"."status" = 'confirmed'
);
