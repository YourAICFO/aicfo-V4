CREATE UNIQUE INDEX IF NOT EXISTS invoices_gateway_payment_id_unique_idx
  ON invoices(gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;
