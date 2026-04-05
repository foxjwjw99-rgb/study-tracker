-- CreateEnum
CREATE TYPE "WrongQuestionStatus" AS ENUM ('ACTIVE', 'CORRECTED', 'MASTERED', 'ARCHIVED');

-- AlterTable: Add new columns to WrongQuestion
ALTER TABLE "WrongQuestion"
ADD COLUMN "question_id" TEXT,
ADD COLUMN "unit_id" TEXT,
ADD COLUMN "source_type" TEXT,
ADD COLUMN "last_wrong_date" TIMESTAMP(3),
ADD COLUMN "last_reviewed_at" TIMESTAMP(3),
ADD COLUMN "wrong_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "review_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "correct_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "is_manual_added" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_careless" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "status_new" "WrongQuestionStatus" NOT NULL DEFAULT 'ACTIVE';

-- Migrate existing status string values to new enum
UPDATE "WrongQuestion" SET "status_new" = 'ACTIVE' WHERE "status" = '未訂正';
UPDATE "WrongQuestion" SET "status_new" = 'CORRECTED' WHERE "status" = '已訂正';
UPDATE "WrongQuestion" SET "status_new" = 'MASTERED' WHERE "status" = '已掌握';
-- Keep ACTIVE for any other unknown values

-- Drop old status column and rename new one
ALTER TABLE "WrongQuestion" DROP COLUMN "status";
ALTER TABLE "WrongQuestion" RENAME COLUMN "status_new" TO "status";

-- CreateTable: WrongQuestionReviewLog
CREATE TABLE "WrongQuestionReviewLog" (
    "id" TEXT NOT NULL,
    "wrong_question_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_id" TEXT,
    "answered_correctly" BOOLEAN NOT NULL,
    "selected_answer" INTEGER,
    "typed_answer" TEXT,
    "review_mode" TEXT,
    "confidence" INTEGER,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WrongQuestionReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WrongQuestion_user_id_question_id_key" ON "WrongQuestion"("user_id", "question_id");

-- CreateIndex (partial unique: only when question_id is NOT NULL)
-- Note: PostgreSQL automatically excludes NULLs from unique constraints

-- CreateIndex
CREATE INDEX "WrongQuestion_user_id_subject_id_next_review_date_idx" ON "WrongQuestion"("user_id", "subject_id", "next_review_date");

-- CreateIndex
CREATE INDEX "WrongQuestion_user_id_status_next_review_date_idx" ON "WrongQuestion"("user_id", "status", "next_review_date");

-- CreateIndex
CREATE INDEX "WrongQuestion_user_id_question_id_idx" ON "WrongQuestion"("user_id", "question_id");

-- CreateIndex
CREATE INDEX "WrongQuestionReviewLog_wrong_question_id_idx" ON "WrongQuestionReviewLog"("wrong_question_id");

-- CreateIndex
CREATE INDEX "WrongQuestionReviewLog_user_id_reviewed_at_idx" ON "WrongQuestionReviewLog"("user_id", "reviewed_at");

-- AddForeignKey
ALTER TABLE "WrongQuestion" ADD CONSTRAINT "WrongQuestion_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrongQuestion" ADD CONSTRAINT "WrongQuestion_unit_id_fkey"
FOREIGN KEY ("unit_id") REFERENCES "ExamUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrongQuestionReviewLog" ADD CONSTRAINT "WrongQuestionReviewLog_wrong_question_id_fkey"
FOREIGN KEY ("wrong_question_id") REFERENCES "WrongQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrongQuestionReviewLog" ADD CONSTRAINT "WrongQuestionReviewLog_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
