-- This migration can precede creation of the implicit relation table on a
-- fresh database. If the table already exists, replace its unique index with
-- the primary key; otherwise the later taxonomy migration creates it with the
-- primary key already in place.
DO $$
BEGIN
  IF to_regclass('public."_ProductProblems"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public."_ProductProblems"'::regclass
        AND contype = 'p'
    ) THEN
      ALTER TABLE "_ProductProblems"
        ADD CONSTRAINT "_ProductProblems_AB_pkey" PRIMARY KEY ("A", "B");
    END IF;

    DROP INDEX IF EXISTS "_ProductProblems_AB_unique";
  END IF;
END $$;
