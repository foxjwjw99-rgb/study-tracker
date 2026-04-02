-- CreateTable
CREATE TABLE "TargetProgram" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "school_name" TEXT NOT NULL,
    "department_name" TEXT NOT NULL,
    "exam_year" INTEGER NOT NULL,
    "last_year_line" DOUBLE PRECISION NOT NULL,
    "safe_line" DOUBLE PRECISION NOT NULL,
    "ideal_line" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionSnapshot" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_program_id" TEXT NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimated_total_conservative" DOUBLE PRECISION NOT NULL,
    "estimated_total_median" DOUBLE PRECISION NOT NULL,
    "estimated_total_optimistic" DOUBLE PRECISION NOT NULL,
    "gap_vs_last_year_line" DOUBLE PRECISION NOT NULL,
    "admission_level" TEXT NOT NULL,
    "confidence_level" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TargetProgram_user_id_idx" ON "TargetProgram"("user_id");

-- CreateIndex
CREATE INDEX "PredictionSnapshot_user_id_target_program_id_snapshot_date_idx" ON "PredictionSnapshot"("user_id", "target_program_id", "snapshot_date");

-- AddForeignKey
ALTER TABLE "TargetProgram" ADD CONSTRAINT "TargetProgram_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionSnapshot" ADD CONSTRAINT "PredictionSnapshot_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionSnapshot" ADD CONSTRAINT "PredictionSnapshot_target_program_id_fkey" FOREIGN KEY ("target_program_id") REFERENCES "TargetProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
