-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "business_status" TEXT,
ADD COLUMN     "enriched_at" TIMESTAMP(3),
ADD COLUMN     "field_sources" JSONB,
ADD COLUMN     "google_maps_url" TEXT,
ADD COLUMN     "match_candidates" JSONB,
ADD COLUMN     "match_status" TEXT NOT NULL DEFAULT 'unmatched';

-- CreateIndex
CREATE INDEX "Location_match_status_idx" ON "Location"("match_status");

