-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "avgCost" INTEGER,
ADD COLUMN     "avg_stay_minutes" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "open_hours" JSONB;
