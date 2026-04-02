-- Add fill-in-the-blank support to Question table
ALTER TABLE "Question" ADD COLUMN "question_type" TEXT NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE "Question" ADD COLUMN "text_answer" TEXT;
