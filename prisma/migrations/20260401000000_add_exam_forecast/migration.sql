-- Add exam_weight column to Subject
ALTER TABLE "Subject" ADD COLUMN "exam_weight" DOUBLE PRECISION;

-- Create ExamSyllabusUnit table
CREATE TABLE "ExamSyllabusUnit" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "unit_name"  TEXT NOT NULL,
  "weight"     DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamSyllabusUnit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ExamSyllabusUnit"
  ADD CONSTRAINT "ExamSyllabusUnit_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ExamSyllabusUnit_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ExamSyllabusUnit_subject_id_unit_name_key"
  ON "ExamSyllabusUnit"("subject_id", "unit_name");
CREATE INDEX "ExamSyllabusUnit_user_id_subject_id_idx"
  ON "ExamSyllabusUnit"("user_id", "subject_id");
