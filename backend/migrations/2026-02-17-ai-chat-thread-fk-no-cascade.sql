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
      AND rel.relname = 'ai_chat_threads'
      AND att.attname IN ('user_id', 'company_id')
  LOOP
    EXECUTE format('ALTER TABLE public.ai_chat_threads DROP CONSTRAINT IF EXISTS %I', fk_name);
  END LOOP;
END $$;

ALTER TABLE public.ai_chat_threads
  ADD CONSTRAINT ai_chat_threads_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ai_chat_threads_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
