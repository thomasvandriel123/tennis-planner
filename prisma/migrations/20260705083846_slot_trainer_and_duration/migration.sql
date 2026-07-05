-- AlterTable
ALTER TABLE "RecurringSlot" ADD COLUMN     "trainerId" TEXT;

-- AlterTable
ALTER TABLE "TrainingPeriod" ADD COLUMN     "sessionDurationMinutes" INTEGER NOT NULL DEFAULT 60;

-- CreateIndex
CREATE INDEX "RecurringSlot_trainerId_idx" ON "RecurringSlot"("trainerId");

-- AddForeignKey
ALTER TABLE "RecurringSlot" ADD CONSTRAINT "RecurringSlot_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
