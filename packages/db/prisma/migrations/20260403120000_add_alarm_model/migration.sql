-- CreateEnum
CREATE TYPE "alarm_status" AS ENUM ('scheduled', 'ringing', 'acknowledged', 'cancelled', 'failed');

-- CreateTable
CREATE TABLE "alarms" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Wake up alarm',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "alarm_status" NOT NULL DEFAULT 'scheduled',
    "repeat_count" INTEGER NOT NULL DEFAULT 0,
    "call_sid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alarms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alarms_user_id_idx" ON "alarms"("user_id");

-- CreateIndex
CREATE INDEX "alarms_scheduled_at_status_idx" ON "alarms"("scheduled_at", "status");

-- AddForeignKey
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
