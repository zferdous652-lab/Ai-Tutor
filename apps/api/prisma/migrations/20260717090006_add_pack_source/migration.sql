-- CreateEnum
CREATE TYPE "PackSource" AS ENUM ('AI', 'MANUAL');

-- AlterTable
ALTER TABLE "TutorPack" ADD COLUMN     "source" "PackSource" NOT NULL DEFAULT 'AI';
