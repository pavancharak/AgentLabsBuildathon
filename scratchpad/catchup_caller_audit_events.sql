-- Catch-up: applies the two unapplied caller_audit_events migrations
-- (20260816120000, 20260818130000). Confirmed live schema is missing
-- principal_id, severity, and both later type_check values -- last
-- applied migration on this table was 20260812120000
-- (add_capability_to_caller_audit_events.sql). Idempotent (IF NOT
-- EXISTS / DROP CONSTRAINT IF EXISTS throughout), safe to run even if
-- partially applied.

-- Source: supabase/migrations/20260816120000_add_principal_to_caller_audit_events.sql
ALTER TABLE caller_audit_events
DROP CONSTRAINT IF EXISTS caller_audit_events_type_check;

ALTER TABLE caller_audit_events
ADD CONSTRAINT caller_audit_events_type_check
CHECK (type IN (
    'caller.authenticated',
    'caller.rejected',
    'caller.capability_denied',
    'caller.principal_denied'
));

ALTER TABLE caller_audit_events
ADD COLUMN IF NOT EXISTS principal_id TEXT;

CREATE INDEX IF NOT EXISTS idx_caller_audit_events_principal_id
ON caller_audit_events (
    principal_id
)
WHERE principal_id IS NOT NULL;

-- Source: supabase/migrations/20260818130000_add_non_human_denied_to_caller_audit_events.sql
ALTER TABLE caller_audit_events
DROP CONSTRAINT IF EXISTS caller_audit_events_type_check;

ALTER TABLE caller_audit_events
ADD CONSTRAINT caller_audit_events_type_check
CHECK (type IN (
    'caller.authenticated',
    'caller.rejected',
    'caller.capability_denied',
    'caller.principal_denied',
    'caller.non_human_denied'
));

ALTER TABLE caller_audit_events
ADD COLUMN IF NOT EXISTS severity TEXT;

CREATE INDEX IF NOT EXISTS idx_caller_audit_events_severity
ON caller_audit_events (
    severity
)
WHERE severity IS NOT NULL;
