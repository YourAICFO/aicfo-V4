-- Connector Sync Status Layer (additive migration)
-- Tables for tracking connector clients, sync runs, and events

-- 1. connector_clients - Stores registered connectors per company/device
CREATE TABLE IF NOT EXISTS connector_clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    device_name text,
    os text,
    app_version text,
    last_seen_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on company_id + device_id combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_connector_clients_company_device 
ON connector_clients(company_id, device_id);

-- Index for efficient lookup by company
CREATE INDEX IF NOT EXISTS idx_connector_clients_company 
ON connector_clients(company_id);

-- 2. integration_sync_runs - One row per sync attempt
CREATE TABLE IF NOT EXISTS integration_sync_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    integration_type text NOT NULL DEFAULT 'tally',
    connector_client_id uuid REFERENCES connector_clients(id) ON DELETE SET NULL,
    status text NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed', 'partial')),
    stage text NOT NULL CHECK (stage IN ('connect', 'discover', 'fetch', 'upload', 'normalize', 'snapshot', 'done')),
    progress int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    last_error text,
    last_error_at timestamptz,
    stats jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_company_started 
ON integration_sync_runs(company_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_company_status 
ON integration_sync_runs(company_id, status);

CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_connector 
ON integration_sync_runs(connector_client_id);

CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_status 
ON integration_sync_runs(status);

-- 3. integration_sync_events - Append-only event log
CREATE TABLE IF NOT EXISTS integration_sync_events (
    id bigserial PRIMARY KEY,
    run_id uuid NOT NULL REFERENCES integration_sync_runs(id) ON DELETE CASCADE,
    time timestamptz NOT NULL DEFAULT now(),
    level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    event text NOT NULL,
    message text,
    data jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for efficient event queries
CREATE INDEX IF NOT EXISTS idx_integration_sync_events_run_time 
ON integration_sync_events(run_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_integration_sync_events_level_time 
ON integration_sync_events(level, time DESC);

CREATE INDEX IF NOT EXISTS idx_integration_sync_events_time 
ON integration_sync_events(time DESC);

-- 4. Admin dashboard view for sync health
CREATE OR REPLACE VIEW admin_sync_health AS
SELECT 
    c.id AS company_id,
    c.name AS company_name,
    -- Latest run information
    lr.id AS last_run_id,
    lr.status AS last_status,
    lr.stage AS last_stage,
    lr.progress AS last_progress,
    lr.started_at AS last_started_at,
    lr.finished_at AS last_finished_at,
    lr.last_error,
    -- Connector information
    cc.last_seen_at AS last_seen_connector_at,
    -- Ingestion metrics
    COALESCE(am.months_ingested, 0) AS months_ingested,
    COALESCE(mtb.months_snapshotted, 0) AS months_snapshotted,
    -- Mapping coverage
    COALESCE(mc.mapping_coverage_percent, 0) AS mapping_coverage_percent,
    -- Estimated readiness calculation
    CASE 
        WHEN lr.status = 'success' AND COALESCE(mtb.months_snapshotted, 0) > 0 THEN true
        WHEN lr.status = 'running' THEN false
        WHEN lr.status = 'failed' THEN false
        WHEN lr.finished_at IS NULL THEN false
        WHEN EXTRACT(EPOCH FROM (now() - lr.finished_at)) > 86400 THEN false -- 24 hours
        ELSE true
    END AS estimated_ready,
    CASE 
        WHEN lr.status = 'running' THEN 'Sync in progress'
        WHEN lr.status = 'failed' THEN 'Last sync failed: ' || COALESCE(lr.last_error, 'Unknown error')
        WHEN lr.status = 'success' AND COALESCE(mtb.months_snapshotted, 0) = 0 THEN 'No snapshot data available'
        WHEN EXTRACT(EPOCH FROM (now() - lr.finished_at)) > 86400 THEN 'Sync is stale (over 24 hours)'
        WHEN COALESCE(mc.mapping_coverage_percent, 0) < 50 THEN 'Low mapping coverage'
        ELSE 'Ready for analysis'
    END AS estimated_ready_reason
FROM companies c
-- Get latest run per company
LEFT JOIN LATERAL (
    SELECT * FROM integration_sync_runs 
    WHERE company_id = c.id 
    ORDER BY started_at DESC 
    LIMIT 1
) lr ON true
-- Get latest connector client
LEFT JOIN LATERAL (
    SELECT * FROM connector_clients 
    WHERE company_id = c.id 
    ORDER BY last_seen_at DESC NULLS LAST
    LIMIT 1
) cc ON true
-- Get months ingested
LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT month) AS months_ingested
    FROM accounting_months
    WHERE company_id = c.id
) am ON true
-- Get months snapshotted
LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT month) AS months_snapshotted
    FROM monthly_trial_balance_summary
    WHERE company_id = c.id
) mtb ON true
-- Get mapping coverage
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*)::int AS ledgers_total,
        COUNT(*) FILTER (
            WHERE LOWER(sl.source_ledger_name) IN (
                SELECT DISTINCT LOWER(source_term) 
                FROM accounting_term_mapping
            )
        )::int AS ledgers_mapped,
        ROUND(
            CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE (
                    COUNT(*) FILTER (
                        WHERE LOWER(sl.source_ledger_name) IN (
                            SELECT DISTINCT LOWER(source_term) 
                            FROM accounting_term_mapping
                        )
                    )::numeric / COUNT(*)::numeric
                ) * 100
            END,
            2
        ) AS mapping_coverage_percent
    FROM source_ledgers sl
    WHERE sl.company_id = c.id
) mc ON true;

-- Create indexes on the view for better performance
CREATE INDEX IF NOT EXISTS idx_admin_sync_health_company 
ON integration_sync_runs(company_id);

-- Add updated_at trigger for connector_clients
CREATE OR REPLACE FUNCTION update_connector_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_connector_clients_updated_at
    BEFORE UPDATE ON connector_clients
    FOR EACH ROW
    EXECUTE FUNCTION update_connector_clients_updated_at();

-- Add comment documentation
COMMENT ON TABLE connector_clients IS 'Stores registered connector clients (desktop apps) per company';
COMMENT ON TABLE integration_sync_runs IS 'Tracks individual sync attempts and their status';
COMMENT ON TABLE integration_sync_events IS 'Append-only event log for sync debugging';
COMMENT ON VIEW admin_sync_health IS 'Admin dashboard view for sync health monitoring';