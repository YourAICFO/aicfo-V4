-- Ensure data_sync_status has snake_case updated_at for connector status/v1 (fixes "column updated at does not exist" when app expects updated_at).
-- Phase9 created the table with "updatedAt"/"createdAt"; some environments may have only those. We add updated_at and use it in reads.

-- Add updated_at if missing (standard snake_case column)
ALTER TABLE data_sync_status
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill from "updatedAt" if that column exists (check at runtime; harmless if column missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'data_sync_status' AND column_name = 'updatedAt'
  ) THEN
    UPDATE data_sync_status SET updated_at = "updatedAt"::timestamptz WHERE "updatedAt" IS NOT NULL;
  END IF;
END $$;
