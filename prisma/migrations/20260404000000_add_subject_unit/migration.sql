-- CreateEnum
CREATE TYPE "SubjectUnitSource" AS ENUM ('MANUAL', 'IMPORTED', 'SYSTEM');

-- CreateTable: ExamUnit (SubjectUnit model with @@map("ExamUnit"))
CREATE TABLE "ExamUnit" (
    "id"          TEXT NOT NULL,
    "subject_id"  TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "slug"        TEXT,
    "order"       INTEGER NOT NULL DEFAULT 0,
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "source"      "SubjectUnitSource" NOT NULL DEFAULT 'MANUAL',
    "notes"       TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SubjectUnitAlias
CREATE TABLE "SubjectUnitAlias" (
    "id"               TEXT NOT NULL,
    "subject_id"       TEXT NOT NULL,
    "subject_unit_id"  TEXT NOT NULL,
    "alias"            TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectUnitAlias_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add unit_id to ExamSyllabusUnit
ALTER TABLE "ExamSyllabusUnit" ADD COLUMN "unit_id" TEXT;

-- AlterTable: add unit_id to StudyLog
ALTER TABLE "StudyLog" ADD COLUMN "unit_id" TEXT;

-- AlterTable: add unit_id to PracticeLog
ALTER TABLE "PracticeLog" ADD COLUMN "unit_id" TEXT;

-- CreateIndex for ExamUnit
CREATE UNIQUE INDEX "ExamUnit_subject_id_slug_key" ON "ExamUnit"("subject_id", "slug");
CREATE INDEX "ExamUnit_subject_id_name_idx" ON "ExamUnit"("subject_id", "name");
CREATE INDEX "ExamUnit_subject_id_is_active_idx" ON "ExamUnit"("subject_id", "is_active");
CREATE INDEX "ExamUnit_subject_id_order_idx" ON "ExamUnit"("subject_id", "order");

-- CreateIndex for SubjectUnitAlias
CREATE UNIQUE INDEX "SubjectUnitAlias_subject_id_normalized_alias_key" ON "SubjectUnitAlias"("subject_id", "normalized_alias");
CREATE INDEX "SubjectUnitAlias_subject_unit_id_idx" ON "SubjectUnitAlias"("subject_unit_id");
CREATE INDEX "SubjectUnitAlias_subject_id_normalized_alias_idx" ON "SubjectUnitAlias"("subject_id", "normalized_alias");

-- CreateIndex for unit_id FK columns
CREATE INDEX "ExamSyllabusUnit_subject_id_unit_id_idx" ON "ExamSyllabusUnit"("subject_id", "unit_id");
CREATE INDEX "StudyLog_subject_id_unit_id_study_date_idx" ON "StudyLog"("subject_id", "unit_id", "study_date");
CREATE INDEX "PracticeLog_subject_id_unit_id_practice_date_idx" ON "PracticeLog"("subject_id", "unit_id", "practice_date");

-- AddForeignKey for ExamUnit
ALTER TABLE "ExamUnit" ADD CONSTRAINT "ExamUnit_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for SubjectUnitAlias
ALTER TABLE "SubjectUnitAlias" ADD CONSTRAINT "SubjectUnitAlias_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubjectUnitAlias" ADD CONSTRAINT "SubjectUnitAlias_subject_unit_id_fkey"
    FOREIGN KEY ("subject_unit_id") REFERENCES "ExamUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for unit_id on ExamSyllabusUnit
ALTER TABLE "ExamSyllabusUnit" ADD CONSTRAINT "ExamSyllabusUnit_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "ExamUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for unit_id on StudyLog
ALTER TABLE "StudyLog" ADD CONSTRAINT "StudyLog_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "ExamUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for unit_id on PracticeLog
ALTER TABLE "PracticeLog" ADD CONSTRAINT "PracticeLog_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "ExamUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
