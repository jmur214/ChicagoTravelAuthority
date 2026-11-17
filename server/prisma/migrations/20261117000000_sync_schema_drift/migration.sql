-- Brings the migration history in line with schema.prisma, which had been changed
-- (likely via `prisma db push`) without a migration. Databases created that way
-- already contain these changes; mark this migration as applied instead of running it:
--   npx prisma migrate resolve --applied 20261117000000_sync_schema_drift

-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_category_id_fkey";

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "eventsInfo" TEXT,
ADD COLUMN     "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "menuUrl" TEXT,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "reviewCount" INTEGER,
ADD COLUMN     "user_verified_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verified_vibe" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "category_id";

-- AlterTable
ALTER TABLE "TagCategory" ADD COLUMN     "color" TEXT DEFAULT '#ffffff',
ADD COLUMN     "parent_id" INTEGER,
ADD COLUMN     "shape" TEXT DEFAULT 'circle';

-- CreateTable
CREATE TABLE "_LocationToTagCategory" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_TagToTagCategory" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_LocationToTagCategory_AB_unique" ON "_LocationToTagCategory"("A", "B");

-- CreateIndex
CREATE INDEX "_LocationToTagCategory_B_index" ON "_LocationToTagCategory"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_TagToTagCategory_AB_unique" ON "_TagToTagCategory"("A", "B");

-- CreateIndex
CREATE INDEX "_TagToTagCategory_B_index" ON "_TagToTagCategory"("B");

-- AddForeignKey
ALTER TABLE "TagCategory" ADD CONSTRAINT "TagCategory_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "TagCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LocationToTagCategory" ADD CONSTRAINT "_LocationToTagCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LocationToTagCategory" ADD CONSTRAINT "_LocationToTagCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "TagCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTagCategory" ADD CONSTRAINT "_TagToTagCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTagCategory" ADD CONSTRAINT "_TagToTagCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "TagCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

