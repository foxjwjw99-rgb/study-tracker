-- PR1: stabilize unit linkage, wrong-question snapshots, and group external IDs
-- Assumes prior subject-unit and wrong-question base migrations have already run.

ALTER TABLE "Question" ADD COLUMN "unit_id" TEXT;
ALTER TABLE "QuestionGroup" ADD COLUMN "unit_id" TEXT;
ALTER TABLE "QuestionGroup" ADD COLUMN "external_id" TEXT;
ALTER TABLE "WrongQuestion" ADD COLUMN "question_text" TEXT;
ALTER TABLE "WrongQuestion" ADD COLUMN "correct_answer_text" TEXT;
ALTER TABLE "WrongQuestion" ADD COLUMN "user_answer_text" TEXT;
ALTER TABLE "ReviewTask" ADD COLUMN "unit_id" TEXT;

DROP INDEX IF EXISTS "WrongQuestion_user_id_question_id_key";

-- Backfill units from existing topic strings
INSERT INTO "ExamUnit" ("id", "subject_id", "name", "slug", "order", "is_active", "source", "created_at", "updated_at")
SELECT
  'unit_' || md5(q."subject_id" || '::' || lower(trim(q."topic"))),
  q."subject_id",
  trim(q."topic"),
  regexp_replace(lower(trim(q."topic")), '[^[:alnum:]]+', '-', 'g'),
  0,
  true,
  'SYSTEM'::"SubjectUnitSource",
  NOW(),
  NOW()
FROM (
  SELECT "subject_id", "topic" FROM "Question"
  UNION
  SELECT "subject_id", "topic" FROM "QuestionGroup"
  UNION
  SELECT "subject_id", "topic" FROM "PracticeLog"
  UNION
  SELECT "subject_id", "topic" FROM "StudyLog"
  UNION
  SELECT "subject_id", "topic" FROM "WrongQuestion"
  UNION
  SELECT "subject_id", "topic" FROM "ReviewTask"
) q
WHERE trim(coalesce(q."topic", '')) <> ''
ON CONFLICT ("subject_id", "slug") DO NOTHING;

INSERT INTO "SubjectUnitAlias" ("id", "subject_id", "subject_unit_id", "alias", "normalized_alias", "created_at", "updated_at")
SELECT
  'alias_' || md5(eu."subject_id" || '::' || eu."name"),
  eu."subject_id",
  eu."id",
  eu."name",
  replace(replace(replace(replace(lower(trim(eu."name")), ' ', ''), '　', ''), '（', ''), '）', ''),
  NOW(),
  NOW()
FROM "ExamUnit" eu
ON CONFLICT ("subject_id", "normalized_alias") DO NOTHING;

UPDATE "Question" q
SET "unit_id" = eu."id"
FROM "ExamUnit" eu
WHERE eu."subject_id" = q."subject_id"
  AND eu."name" = trim(q."topic")
  AND q."unit_id" IS NULL;

UPDATE "QuestionGroup" qg
SET "unit_id" = eu."id"
FROM "ExamUnit" eu
WHERE eu."subject_id" = qg."subject_id"
  AND eu."name" = trim(qg."topic")
  AND qg."unit_id" IS NULL;

UPDATE "WrongQuestion" wq
SET "unit_id" = eu."id"
FROM "ExamUnit" eu
WHERE eu."subject_id" = wq."subject_id"
  AND eu."name" = trim(wq."topic")
  AND wq."unit_id" IS NULL;

UPDATE "ReviewTask" rt
SET "unit_id" = eu."id"
FROM "ExamUnit" eu
WHERE eu."subject_id" = rt."subject_id"
  AND eu."name" = trim(rt."topic")
  AND rt."unit_id" IS NULL;

ALTER TABLE "Question" ALTER COLUMN "unit_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Question_subject_id_unit_id_idx" ON "Question"("subject_id", "unit_id");
CREATE INDEX IF NOT EXISTS "QuestionGroup_subject_id_unit_id_idx" ON "QuestionGroup"("subject_id", "unit_id");
CREATE INDEX IF NOT EXISTS "WrongQuestion_subject_id_unit_id_idx" ON "WrongQuestion"("subject_id", "unit_id");
CREATE INDEX IF NOT EXISTS "ReviewTask_subject_id_unit_id_idx" ON "ReviewTask"("subject_id", "unit_id");
CREATE UNIQUE INDEX "QuestionGroup_user_id_subject_id_external_id_key" ON "QuestionGroup"("user_id", "subject_id", "external_id");

ALTER TABLE "Question" ADD CONSTRAINT "Question_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "ExamUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "ExamUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "ExamUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
