-- CreateEnum
CREATE TYPE "VocabularyWordStatus" AS ENUM ('NEW', 'LEARNING', 'FAMILIAR');

-- AlterTable: migrate existing string values to enum
ALTER TABLE "VocabularyWord"
  ALTER COLUMN "status" TYPE "VocabularyWordStatus" USING "status"::"VocabularyWordStatus";

-- CreateIndex: ReviewTask(user_id, subject_id)
CREATE INDEX "ReviewTask_user_id_subject_id_idx" ON "ReviewTask"("user_id", "subject_id");

-- CreateIndex: VocabularyWord(user_id, next_review_date)
CREATE INDEX "VocabularyWord_user_id_next_review_date_idx" ON "VocabularyWord"("user_id", "next_review_date");

-- CreateIndex: VocabularyWord(user_id, status)
CREATE INDEX "VocabularyWord_user_id_status_idx" ON "VocabularyWord"("user_id", "status");
