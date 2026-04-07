-- Add table_data column to Question and QuestionGroup for structured table support in JSON import

ALTER TABLE "Question" ADD COLUMN "table_data" TEXT;
ALTER TABLE "QuestionGroup" ADD COLUMN "table_data" TEXT;
