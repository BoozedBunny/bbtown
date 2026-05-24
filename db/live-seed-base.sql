-- bbtown live base seed (without Prisma)
-- Purpose: minimal runtime data so web endpoints have sane defaults.
-- Safe to run multiple times.

BEGIN;

-- Towns expected by frontend selector
INSERT INTO "Town" ("id", "name", "bankBalance") VALUES
  (1, 'HangoverHollow', 1000000),
  (2, 'TipsyToadstool', 1000000),
  (3, 'RumTumbleWeed', 1000000)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name";

-- Base buildings for town 1 (ids from HARDCODED_BUILDINGS in apps/web/app/town/[townId]/town-config.ts)
INSERT INTO "BuildingState" ("id", "townId", "title", "forSale", "price", "employees", "ownerId") VALUES
  ('8',  '1', '1001 Nights', true, 25000, 0, NULL),
  ('9',  '1', 'Akihabara', true, 26000, 0, NULL),
  ('10', '1', 'Boat House', true, 24000, 0, NULL),
  ('11', '1', 'Dune Partyhouse', true, 24500, 0, NULL),
  ('12', '1', 'Feet House', true, 23000, 0, NULL),
  ('13', '1', 'Holy Rave', true, 27000, 0, NULL),
  ('14', '1', 'Hoppy Heaven', true, 25500, 0, NULL),
  ('15', '1', 'Pipe House', true, 25000, 0, NULL),
  ('16', '1', 'Up Up Balloon', true, 22000, 0, NULL),
  ('17', '1', 'Up Up House', true, 24500, 0, NULL),
  ('18', '1', 'Vino Vibes', true, 26500, 0, NULL),
  ('19', '1', 'Vodka Palace', true, 29000, 0, NULL),
  ('20', '1', 'Vulcan Temple', true, 28000, 0, NULL),
  ('21', '1', 'Arena', true, 50000, 0, NULL),
  ('22', '1', 'Love Palace', true, 26000, 0, NULL),
  ('23', '1', 'Gnome Party House', true, 25000, 0, NULL),
  ('24', '1', 'Casino Pyramid', true, 45000, 0, NULL),
  ('25', '1', 'Stock Exchange', true, 42000, 0, NULL),
  ('26', '1', 'BBTown Bank', true, 48000, 0, NULL),
  ('27', '1', 'WhimsicLe''s House', true, 24000, 0, NULL)
ON CONFLICT ("id") DO UPDATE
SET
  "townId" = EXCLUDED."townId",
  "title" = EXCLUDED."title",
  "forSale" = EXCLUDED."forSale",
  "price" = EXCLUDED."price";

COMMIT;
