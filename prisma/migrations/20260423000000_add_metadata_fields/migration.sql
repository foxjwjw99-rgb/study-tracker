-- AlterTable: Add metadata fields to Question
ALTER TABLE "Question" ADD COLUMN "difficulty" TEXT;
ALTER TABLE "Question" ADD COLUMN "tags"       TEXT;
ALTER TABLE "Question" ADD COLUMN "source"     TEXT;
ALTER TABLE "Question" ADD COLUMN "hint"       TEXT;
ALTER TABLE "Question" ADD COLUMN "blanks"     TEXT;
ALTER TABLE "Question" ADD COLUMN "status"     TEXT NOT NULL DEFAULT 'published';

-- AlterTable: Add metadata fields to QuestionGroup
ALTER TABLE "QuestionGroup" ADD COLUMN "difficulty" TEXT;
ALTER TABLE "QuestionGroup" ADD COLUMN "tags"       TEXT;
ALTER TABLE "QuestionGroup" ADD COLUMN "status"     TEXT NOT NULL DEFAULT 'published';
