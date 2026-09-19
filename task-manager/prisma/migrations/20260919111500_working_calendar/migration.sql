-- AlterTable
ALTER TABLE "TaskTemplate" ADD COLUMN     "skipNonWorking" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "NonWorkingDay" (
    "day" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NonWorkingDay_pkey" PRIMARY KEY ("day")
);

