-- 新增 AI 相關欄位到 Question 表
ALTER TABLE "Question"
ADD COLUMN "ai_explanation" TEXT;

-- 新增 enum 型別給 QuestionGroup
CREATE TYPE "AiUnitMappingStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- 新增 AI 單元對應追蹤欄位到 QuestionGroup 表
ALTER TABLE "QuestionGroup"
ADD COLUMN "ai_unit_mapping_status" "AiUnitMappingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "ai_unit_mapping_note" TEXT,
ADD COLUMN "ai_unit_mapping_at" TIMESTAMP(3);
