-- CreateTable
CREATE TABLE "_PreferenceSlots" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PreferenceSlots_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_PreferenceSlots_B_index" ON "_PreferenceSlots"("B");

-- AddForeignKey
ALTER TABLE "_PreferenceSlots" ADD CONSTRAINT "_PreferenceSlots_A_fkey" FOREIGN KEY ("A") REFERENCES "Preference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PreferenceSlots" ADD CONSTRAINT "_PreferenceSlots_B_fkey" FOREIGN KEY ("B") REFERENCES "RecurringSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
