-- CreateEnum
CREATE TYPE "TutorPackStatus" AS ENUM ('PROCESSING', 'DRAFT', 'FAILED');

-- CreateEnum
CREATE TYPE "PackTier" AS ENUM ('BASIC', 'PREMIUM', 'XPOINTS');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- DropForeignKey
ALTER TABLE "Chapter" DROP CONSTRAINT "Chapter_documentId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_familyId_fkey";

-- DropIndex
DROP INDEX "Chapter_documentId_order_key";

-- AlterTable
ALTER TABLE "Chapter" DROP COLUMN "documentId",
ADD COLUMN     "tutorPackId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Document";

-- DropEnum
DROP TYPE "DocumentStatus";

-- CreateTable
CREATE TABLE "TutorPack" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "tier" "PackTier" NOT NULL DEFAULT 'BASIC',
    "status" "TutorPackStatus" NOT NULL DEFAULT 'PROCESSING',
    "rawText" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tutorPackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_tutorPackId_key" ON "Enrollment"("studentId", "tutorPackId");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_tutorPackId_order_key" ON "Chapter"("tutorPackId", "order");

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_tutorPackId_fkey" FOREIGN KEY ("tutorPackId") REFERENCES "TutorPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_tutorPackId_fkey" FOREIGN KEY ("tutorPackId") REFERENCES "TutorPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

