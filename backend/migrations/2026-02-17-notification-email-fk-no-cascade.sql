DO $$
DECLARE
  fk_name TEXT;
BEGIN
  FOR fk_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND rel.relname = 'company_notification_settings'
      AND att.attname = 'company_id'
  LOOP
    EXECUTE format('ALTER TABLE public.company_notification_settings DROP CONSTRAINT IF EXISTS %I', fk_name);
  END LOOP;
END $$;

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  FOR fk_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND rel.relname = 'email_deliveries'
      AND att.attname = 'company_id'
  LOOP
    EXECUTE format('ALTER TABLE public.email_deliveries DROP CONSTRAINT IF EXISTS %I', fk_name);
  END LOOP;
END $$;

ALTER TABLE public.company_notification_settings
  ADD CONSTRAINT company_notification_settings_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE public.email_deliveries
  ADD CONSTRAINT email_deliveries_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
