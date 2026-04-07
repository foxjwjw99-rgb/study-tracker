-- AlterTable: Add structured content fields to Question
ALTER TABLE "Question" ADD COLUMN "question_structured" TEXT;
ALTER TABLE "Question" ADD COLUMN "options_structured" TEXT;
ALTER TABLE "Question" ADD COLUMN "explanation_structured" TEXT;

-- AlterTable: Add structured content field to QuestionGroup
ALTER TABLE "QuestionGroup" ADD COLUMN "context_structured" TEXT;
