-- Sandbox retention (ADR-0014 open question 3, accepted): every day, delete
-- what visitors sent to the public sandbox more than 7 days ago.
--
-- SANDBOX ONLY. This is not a migration and must never be applied to
-- production. It is installed into the sandbox database by
-- `setup-sandbox.ps1 -Stage Retention`, which refuses production's project,
-- and the function itself refuses to delete anything in a database without
-- the sandbox's active `sandbox:receipt` registration.
--
-- Deleted, when older than the retention period:
--   * each Business Transaction and everything recorded for it (executions,
--     verifications, receipts, overrides, settlement confirmations, the Trust
--     Record, the Refusal Record, the Execution Intent), children first,
--     because they reference business_transactions ON DELETE RESTRICT;
--   * caller and execution audit events;
--   * consumed authorization and approval nonces whose expiry passed more
--     than the period ago (an approval is valid 5 minutes, so a deleted
--     nonce can never be replayed: the expiry check refuses it first);
--   * handbook download leads, which hold an email address;
--   * rate limit counters whose window ended more than a day ago.
-- Kept: policies, approvers, external connector registrations, every change
-- and approval record of governance, and the step up nonces of governance.

CREATE OR REPLACE FUNCTION parmana_sandbox_retention(retention_days INTEGER DEFAULT 7)
RETURNS TABLE (table_name TEXT, deleted BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    cutoff TIMESTAMPTZ := now() - make_interval(days => retention_days);
    old_transactions TEXT[];
    n BIGINT;
BEGIN
    -- 0 deletes everything visitors sent: a manual reset, and what the
    -- kit's check runs inside a transaction it rolls back.
    IF retention_days < 0 THEN
        RAISE EXCEPTION 'retention_days must be 0 or more';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM external_connectors
        WHERE capability = 'sandbox:receipt' AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Not the sandbox database: no active sandbox:receipt registration. Nothing was deleted.';
    END IF;

    SELECT coalesce(array_agg(business_transaction_id), '{}')
    INTO old_transactions
    FROM business_transactions
    WHERE created_at < cutoff;

    DELETE FROM verifications WHERE business_transaction_id = ANY (old_transactions);
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'verifications'; deleted := n; RETURN NEXT;

    DELETE FROM receipts WHERE business_transaction_id = ANY (old_transactions);
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'receipts'; deleted := n; RETURN NEXT;

    DELETE FROM overrides WHERE business_transaction_id = ANY (old_transactions);
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'overrides'; deleted := n; RETURN NEXT;

    DELETE FROM settlement_confirmations WHERE business_transaction_id = ANY (old_transactions);
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'settlement_confirmations'; deleted := n; RETURN NEXT;

    DELETE FROM executions WHERE business_transaction_id = ANY (old_transactions);
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'executions'; deleted := n; RETURN NEXT;

    DELETE FROM execution_trust_records WHERE business_transaction_id = ANY (old_transactions);
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'execution_trust_records'; deleted := n; RETURN NEXT;

    DELETE FROM refusal_records WHERE business_transaction_id = ANY (old_transactions);
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'refusal_records'; deleted := n; RETURN NEXT;

    DELETE FROM execution_intents WHERE business_transaction_id = ANY (old_transactions);
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'execution_intents'; deleted := n; RETURN NEXT;

    DELETE FROM business_transactions WHERE business_transaction_id = ANY (old_transactions);
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'business_transactions'; deleted := n; RETURN NEXT;

    DELETE FROM caller_audit_events WHERE occurred_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'caller_audit_events'; deleted := n; RETURN NEXT;

    DELETE FROM execution_audit_events WHERE occurred_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'execution_audit_events'; deleted := n; RETURN NEXT;

    DELETE FROM consumed_nonces WHERE expires_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'consumed_nonces'; deleted := n; RETURN NEXT;

    DELETE FROM consumed_approval_nonces WHERE expires_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'consumed_approval_nonces'; deleted := n; RETURN NEXT;

    DELETE FROM handbook_download_leads WHERE captured_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'handbook_download_leads'; deleted := n; RETURN NEXT;

    DELETE FROM rate_limit_counters WHERE reset_time < now() - interval '1 day';
    GET DIAGNOSTICS n = ROW_COUNT; table_name := 'rate_limit_counters'; deleted := n; RETURN NEXT;
END;
$$;

-- Not callable through Supabase's REST API by the anon or authenticated
-- roles; only the database owner (and pg_cron, which runs as it) calls it.
REVOKE ALL ON FUNCTION parmana_sandbox_retention(INTEGER) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION parmana_sandbox_retention(INTEGER) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION parmana_sandbox_retention(INTEGER) FROM authenticated;
    END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily at 03:30 UTC. Scheduling the same name again replaces the job.
SELECT cron.schedule(
    'parmana-sandbox-retention',
    '30 3 * * *',
    'SELECT * FROM parmana_sandbox_retention(7)'
);
