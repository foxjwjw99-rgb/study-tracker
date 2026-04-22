-- Introduce VocabularyList as an independent model decoupled from Subject.
-- Each (user_id, Subject.name) that currently has vocabulary words becomes a VocabularyList with the same name.

-- 1. Create VocabularyList table
CREATE TABLE "VocabularyList" (
  "id"          TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VocabularyList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VocabularyList_user_id_name_key" ON "VocabularyList"("user_id", "name");
CREATE INDEX "VocabularyList_user_id_idx" ON "VocabularyList"("user_id");

ALTER TABLE "VocabularyList"
  ADD CONSTRAINT "VocabularyList_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Backfill one list per (user, subject) that has vocabulary words
INSERT INTO "VocabularyList" ("id", "user_id", "name", "created_at", "updated_at")
SELECT
  'vlist_' || substr(md5(random()::text || s."id"), 1, 20),
  s."user_id",
  s."name",
  NOW(),
  NOW()
FROM "Subject" s
WHERE EXISTS (SELECT 1 FROM "VocabularyWord" v WHERE v."subject_id" = s."id")
ON CONFLICT ("user_id", "name") DO NOTHING;

-- 3. VocabularyWord: add list_id, backfill, drop subject_id
ALTER TABLE "VocabularyWord" ADD COLUMN "list_id" TEXT;

UPDATE "VocabularyWord" v
SET "list_id" = vl."id"
FROM "Subject" s
JOIN "VocabularyList" vl ON vl."user_id" = s."user_id" AND vl."name" = s."name"
WHERE v."subject_id" = s."id";

-- Any word that didn't match (shouldn't happen if the backfill above is complete) falls back to a per-user bucket.
-- Guard: if any NULLs remain, fail the migration explicitly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "VocabularyWord" WHERE "list_id" IS NULL) THEN
    RAISE EXCEPTION 'VocabularyWord.list_id backfill incomplete';
  END IF;
END $$;

ALTER TABLE "VocabularyWord" ALTER COLUMN "list_id" SET NOT NULL;

ALTER TABLE "VocabularyWord"
  ADD CONSTRAINT "VocabularyWord_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "VocabularyList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "VocabularyWord_user_id_list_id_word_key" ON "VocabularyWord"("user_id", "list_id", "word");
CREATE INDEX "VocabularyWord_user_id_list_id_idx" ON "VocabularyWord"("user_id", "list_id");

-- Drop old subject linkage
ALTER TABLE "VocabularyWord" DROP CONSTRAINT IF EXISTS "VocabularyWord_subject_id_fkey";
DROP INDEX IF EXISTS "VocabularyWord_user_id_subject_id_word_key";
ALTER TABLE "VocabularyWord" DROP COLUMN "subject_id";

-- 4. VocabularyReviewLog: make subject_id nullable, add list_id, backfill
ALTER TABLE "VocabularyReviewLog" ALTER COLUMN "subject_id" DROP NOT NULL;
ALTER TABLE "VocabularyReviewLog" ADD COLUMN "list_id" TEXT;

UPDATE "VocabularyReviewLog" r
SET "list_id" = v."list_id"
FROM "VocabularyWord" v
WHERE r."vocabulary_word_id" = v."id";

ALTER TABLE "VocabularyReviewLog"
  ADD CONSTRAINT "VocabularyReviewLog_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "VocabularyList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "VocabularyReviewLog_user_id_list_id_created_at_idx" ON "VocabularyReviewLog"("user_id", "list_id", "created_at");

-- 5. ReviewTask: make subject_id nullable, add vocabulary_list_id, backfill vocab rows, null their subject_id
ALTER TABLE "ReviewTask" ALTER COLUMN "subject_id" DROP NOT NULL;
ALTER TABLE "ReviewTask" ADD COLUMN "vocabulary_list_id" TEXT;

UPDATE "ReviewTask" rt
SET "vocabulary_list_id" = v."list_id"
FROM "VocabularyWord" v
WHERE rt."vocabulary_word_id" = v."id";

-- Clear subject_id on vocabulary-sourced tasks (they are now independent of subject)
UPDATE "ReviewTask"
SET "subject_id" = NULL
WHERE "source_type" = 'vocabulary' OR "vocabulary_word_id" IS NOT NULL;

ALTER TABLE "ReviewTask"
  ADD CONSTRAINT "ReviewTask_vocabulary_list_id_fkey"
  FOREIGN KEY ("vocabulary_list_id") REFERENCES "VocabularyList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ReviewTask_user_id_vocabulary_list_id_idx" ON "ReviewTask"("user_id", "vocabulary_list_id");
