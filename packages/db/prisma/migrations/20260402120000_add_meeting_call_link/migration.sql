-- AlterTable
ALTER TABLE "calls" ADD COLUMN "meeting_id" TEXT;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
