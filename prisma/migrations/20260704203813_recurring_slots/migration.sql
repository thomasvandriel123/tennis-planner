/*
  Warnings:

  - You are about to drop the column `endTime` on the `TrainingPeriod` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `TrainingPeriod` table. All the data in the column will be lost.
  - You are about to drop the column `weekdays` on the `TrainingPeriod` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TrainingPeriod" DROP COLUMN "endTime",
DROP COLUMN "startTime",
DROP COLUMN "weekdays";

-- CreateTable
CREATE TABLE "RecurringSlot" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "label" TEXT,

    CONSTRAINT "RecurringSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringSlot_periodId_idx" ON "RecurringSlot"("periodId");

-- AddForeignKey
ALTER TABLE "RecurringSlot" ADD CONSTRAINT "RecurringSlot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TrainingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
