-- Add mastery_score to ExamSyllabusUnit
ALTER TABLE "ExamSyllabusUnit" ADD COLUMN "mastery_score" INTEGER;

-- Create MockExamRecord table
CREATE TABLE "MockExamRecord" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "exam_date"  TIMESTAMP(3) NOT NULL,
  "score"      DOUBLE PRECISION NOT NULL,
  "full_score" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "is_timed"   BOOLEAN NOT NULL DEFAULT false,
  "notes"      TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MockExamRecord_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MockExamRecord"
  ADD CONSTRAINT "MockExamRecord_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MockExamRecord_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MockExamRecord_user_id_subject_id_exam_date_idx"
  ON "MockExamRecord"("user_id", "subject_id", "exam_date");
