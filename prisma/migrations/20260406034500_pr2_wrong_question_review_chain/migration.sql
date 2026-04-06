-- PR2: extend wrong-question review logs for staged 1/3/7/14 review chain

ALTER TABLE "WrongQuestionReviewLog" ADD COLUMN "subject_id" TEXT;
ALTER TABLE "WrongQuestionReviewLog" ADD COLUMN "review_task_id" TEXT;
ALTER TABLE "WrongQuestionReviewLog" ADD COLUMN "review_stage" INTEGER;
ALTER TABLE "WrongQuestionReviewLog" ADD COLUMN "result_score" INTEGER;

UPDATE "WrongQuestionReviewLog" log
SET "subject_id" = wq."subject_id"
FROM "WrongQuestion" wq
WHERE wq."id" = log."wrong_question_id"
  AND log."subject_id" IS NULL;

ALTER TABLE "WrongQuestionReviewLog" ALTER COLUMN "subject_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "WrongQuestionReviewLog_user_id_wrong_question_id_reviewed_at_idx"
  ON "WrongQuestionReviewLog"("user_id", "wrong_question_id", "reviewed_at");

CREATE INDEX IF NOT EXISTS "WrongQuestionReviewLog_user_id_subject_id_reviewed_at_idx"
  ON "WrongQuestionReviewLog"("user_id", "subject_id", "reviewed_at");

ALTER TABLE "WrongQuestionReviewLog"
  ADD CONSTRAINT "WrongQuestionReviewLog_subject_id_fkey"
  FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WrongQuestionReviewLog"
  ADD CONSTRAINT "WrongQuestionReviewLog_review_task_id_fkey"
  FOREIGN KEY ("review_task_id") REFERENCES "ReviewTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
