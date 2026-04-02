-- CreateTable
CREATE TABLE "ExamUnit" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamUnit_subject_id_idx" ON "ExamUnit"("subject_id");

-- AddForeignKey
ALTER TABLE "ExamUnit" ADD CONSTRAINT "ExamUnit_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
