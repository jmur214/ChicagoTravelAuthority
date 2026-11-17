-- DropForeignKey
ALTER TABLE "LocationTag" DROP CONSTRAINT "LocationTag_location_id_fkey";

-- DropForeignKey
ALTER TABLE "LocationTag" DROP CONSTRAINT "LocationTag_tag_id_fkey";

-- AddForeignKey
ALTER TABLE "LocationTag" ADD CONSTRAINT "LocationTag_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationTag" ADD CONSTRAINT "LocationTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

