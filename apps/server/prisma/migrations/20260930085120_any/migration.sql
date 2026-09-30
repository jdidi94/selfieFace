-- AlterTable
ALTER TABLE "_ProductProblems" ADD CONSTRAINT "_ProductProblems_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ProductProblems_AB_unique";
