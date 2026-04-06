-- DropForeignKey
ALTER TABLE "alarms" DROP CONSTRAINT "alarms_user_id_fkey";

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "agenda" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata';

-- AddForeignKey
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
