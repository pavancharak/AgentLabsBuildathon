-- =============================================================================
-- Parmana: consolidated migration script
-- =============================================================================
--
-- Concatenates every file in supabase/migrations/ (filename order, which is
-- also chronological order), unmodified, for one-shot application via the
-- Supabase Dashboard's SQL Editor. See DEPLOYMENT.md's "Applying the schema"
-- section for when and why this is needed.
--
-- Safe to run against an empty project AND safe to re-run against a project
-- this script has already been applied to. No synthetic idempotency
-- wrapping (DO $$ guard blocks) was added, because every statement below is
-- already idempotent as originally authored:
--   - CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
--   - ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   - ALTER TABLE ... ENABLE ROW LEVEL SECURITY (a Postgres no-op if RLS is
--     already enabled -- it does not error on re-application)
--   - ALTER TABLE ... DROP CONSTRAINT IF EXISTS immediately followed by an
--     unconditional ADD CONSTRAINT (self-guarding: a re-run drops what the
--     previous run added, then adds it back identically)
-- Column definitions, primary keys, RLS enablement, and constraints are
-- preserved exactly from source -- nothing here was "improved."


-- =============================================================================
-- Source: supabase/migrations/20260629013035_initial_schema.sql
-- Parmana Initial Schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS business_transactions (

    business_transaction_id TEXT PRIMARY KEY,

    status TEXT NOT NULL,

    authority_json JSONB NOT NULL,

    authorization_json JSONB NOT NULL,

    intent_json JSONB NOT NULL,

    metadata_json JSONB NOT NULL,

    policy_json JSONB NOT NULL,

    signals_json JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL

);

CREATE TABLE IF NOT EXISTS execution_trust_records (

    trust_record_id TEXT PRIMARY KEY,

    business_transaction_id TEXT NOT NULL UNIQUE,

    transaction_json JSONB NOT NULL,

    trust_record_hash TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_transaction
        FOREIGN KEY (
            business_transaction_id
        )
        REFERENCES business_transactions(
            business_transaction_id
        )
        ON DELETE RESTRICT

);

CREATE TABLE IF NOT EXISTS executions (

    execution_id TEXT PRIMARY KEY,

    business_transaction_id TEXT NOT NULL,

    execution_json JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_execution_transaction
        FOREIGN KEY (
            business_transaction_id
        )
        REFERENCES business_transactions(
            business_transaction_id
        )
        ON DELETE RESTRICT

);

CREATE TABLE IF NOT EXISTS overrides (

    override_id TEXT PRIMARY KEY,

    business_transaction_id TEXT NOT NULL,

    override_json JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_override_transaction
        FOREIGN KEY (
            business_transaction_id
        )
        REFERENCES business_transactions(
            business_transaction_id
        )
        ON DELETE RESTRICT

);

CREATE TABLE IF NOT EXISTS verifications (

    verification_id TEXT PRIMARY KEY,

    business_transaction_id TEXT NOT NULL,

    verification_json JSONB NOT NULL,

    verified_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_verification_transaction
        FOREIGN KEY (
            business_transaction_id
        )
        REFERENCES business_transactions(
            business_transaction_id
        )
        ON DELETE RESTRICT

);

CREATE TABLE IF NOT EXISTS receipts (

    receipt_id TEXT PRIMARY KEY,

    business_transaction_id TEXT NOT NULL,

    receipt_json JSONB NOT NULL,

    issued_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_receipt_transaction
        FOREIGN KEY (
            business_transaction_id
        )
        REFERENCES business_transactions(
            business_transaction_id
        )
        ON DELETE RESTRICT

);

CREATE INDEX IF NOT EXISTS idx_business_transactions_created_at
ON business_transactions (
    created_at
);

CREATE INDEX IF NOT EXISTS idx_execution_trust_records_transaction
ON execution_trust_records (
    business_transaction_id
);

CREATE INDEX IF NOT EXISTS idx_execution_transaction
ON executions (
    business_transaction_id
);

CREATE INDEX IF NOT EXISTS idx_executions_created_at
ON executions (
    created_at
);

CREATE INDEX IF NOT EXISTS idx_override_transaction
ON overrides (
    business_transaction_id
);

CREATE INDEX IF NOT EXISTS idx_verification_transaction
ON verifications (
    business_transaction_id
);

CREATE INDEX IF NOT EXISTS idx_verifications_verified_at
ON verifications (
    verified_at
);

CREATE INDEX IF NOT EXISTS idx_receipt_transaction
ON receipts (
    business_transaction_id
);

CREATE INDEX IF NOT EXISTS idx_receipts_issued_at
ON receipts (
    issued_at
);


-- =============================================================================
-- Source: supabase/migrations/20260702183000_add_signature_to_execution_trust_records.sql
-- RFC-0020
-- Persist Trust Record Signature
-- =============================================================================

ALTER TABLE execution_trust_records
ADD COLUMN IF NOT EXISTS signature_json JSONB;

CREATE INDEX IF NOT EXISTS idx_execution_trust_records_signature
ON execution_trust_records
USING GIN (signature_json);


-- =============================================================================
-- Source: supabase/migrations/20260707105527_enable_rls.sql
-- Enable Row Level Security (deny-by-default)
-- =============================================================================
--
-- Security model: only the service-role key, held server-side by Parmana's
-- API (SupabaseClientFactory prefers SUPABASE_SERVICE_ROLE_KEY whenever it is
-- configured), accesses these tables; the service role bypasses RLS by
-- design, so this migration does not need FORCE ROW LEVEL SECURITY and does
-- not define any policy. With RLS enabled and no policy granted, the
-- auto-generated Data API surface is closed to the anon/authenticated roles
-- by default-deny — every one of these tables is otherwise directly
-- reachable through that API once RLS is off, bypassing Parmana's own
-- verification entirely.

ALTER TABLE business_transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE execution_trust_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

ALTER TABLE overrides ENABLE ROW LEVEL SECURITY;

ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source: supabase/migrations/20260711120000_add_trust_record_sequence_columns.sql
-- Add insertion-sequence tiebreak columns
-- =============================================================================
--
-- Purpose: CanonicalSerializer preserves array order when hashing an
-- ExecutionTrustRecord (packages/crypto/src/CanonicalSerializer.ts), so
-- findByTransactionId must reload each collection (executions, overrides,
-- verifications, receipts) in the exact order items were appended. The
-- existing timestamp columns (created_at / verified_at / issued_at) are only
-- millisecond-precision and can tie under concurrent or fast-sequential
-- appends; the primary keys are random UUIDs (crypto.randomUUID()) and carry
-- no ordering information. This adds a monotonic per-table sequence,
-- populated at insert time, to serve as an exact, collision-free tiebreak
-- alongside the existing timestamp ordering.
--
-- Note on backfill: for pre-existing rows, BIGSERIAL assigns values in heap
-- (physical storage) order, not guaranteed original insertion order. This is
-- acceptable here because seq is only ever used as a secondary tiebreak
-- after the primary timestamp sort, and every Execution Trust Record written
-- before this migration has at most a single element per collection, so no
-- existing row's relative order is observable or affected.

ALTER TABLE executions
ADD COLUMN IF NOT EXISTS seq BIGSERIAL;

ALTER TABLE overrides
ADD COLUMN IF NOT EXISTS seq BIGSERIAL;

ALTER TABLE verifications
ADD COLUMN IF NOT EXISTS seq BIGSERIAL;

ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS seq BIGSERIAL;


-- =============================================================================
-- Source: supabase/migrations/20260718090000_add_nonce_and_caller_audit_tables.sql
-- Durable replay protection and caller-audit trail (G-13)
-- =============================================================================
--
-- Closes G-13 (docs/VERIFICATION-GAPS.md): the production-default NonceStore
-- and CallerAuditSink were in-memory and reset on process restart. These two
-- tables back their durable, Supabase-backed replacements
-- (packages/storage/src/supabase/SupabaseNonceStore.ts,
-- packages/api/src/auth/SupabaseCallerAuditSink.ts).

-- -----------------------------------------------------------------------------
-- consumed_nonces
-- -----------------------------------------------------------------------------
--
-- Append-only. Application code never updates or deletes a row. The primary
-- key on nonce IS the atomic-consumption mechanism: two concurrent inserts of
-- the same nonce race at the database, and exactly one succeeds — the other
-- fails with a 23505 unique_violation, which SupabaseNonceStore maps to
-- "already consumed" (see packages/storage/src/errors/PostgresErrorCodes.ts).
-- No PII: a nonce is an opaque random token, not an identifier.

CREATE TABLE IF NOT EXISTS consumed_nonces (

    nonce TEXT PRIMARY KEY,

    -- From the envelope's own expiresAt (NonceStore.checkAndRecord's second
    -- argument) — the only extra field the existing NonceStore interface
    -- already carries. Not currently read back by application code; kept for
    -- a future retention/cleanup job (see VERIFICATION-GAPS.md G-13 residual
    -- note) to bound table growth by purging rows whose expiry has long
    -- since passed.
    expires_at TIMESTAMPTZ NOT NULL,

    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE INDEX IF NOT EXISTS idx_consumed_nonces_expires_at
ON consumed_nonces (
    expires_at
);

ALTER TABLE consumed_nonces ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- caller_audit_events
-- -----------------------------------------------------------------------------
--
-- Append-only. Mirrors packages/api/src/auth/CallerAuditSink.ts's
-- CallerAuditEvent shape exactly. caller_id is a configured identifier
-- (ApiKeyEntry.callerId), never the raw credential; reason is one of a fixed
-- set of short diagnostic strings ("invalid credential", "missing
-- credential") — no PII, no secret material.

CREATE TABLE IF NOT EXISTS caller_audit_events (

    id BIGSERIAL PRIMARY KEY,

    type TEXT NOT NULL
        CHECK (type IN ('caller.authenticated', 'caller.rejected')),

    occurred_at TIMESTAMPTZ NOT NULL,

    route TEXT NOT NULL,

    -- Present only for type = 'caller.authenticated'.
    caller_id TEXT,

    -- Present only for type = 'caller.rejected'. Never the credential itself.
    reason TEXT,

    inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE INDEX IF NOT EXISTS idx_caller_audit_events_occurred_at
ON caller_audit_events (
    occurred_at
);

CREATE INDEX IF NOT EXISTS idx_caller_audit_events_caller_id
ON caller_audit_events (
    caller_id
);

ALTER TABLE caller_audit_events ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source: supabase/migrations/20260718182238_add_razorpay_webhook_tables.sql
-- Razorpay webhook event dedupe and audit trail (M4a)
-- =============================================================================
--
-- Backs the durable, Supabase-backed webhook infrastructure introduced this
-- session (packages/api/src/webhooks/SupabaseRazorpayWebhookEventStore.ts,
-- SupabaseRazorpayWebhookAuditSink.ts). See docs/CLAIMS.md for the scope of
-- what this closes: signature-verified, deduplicated event receipt only.
-- Nothing in this session reads razorpay_webhook_events back to act on a
-- settlement/refund lifecycle change — that is M4b.

-- -----------------------------------------------------------------------------
-- razorpay_webhook_events
-- -----------------------------------------------------------------------------
--
-- Append-only. The primary key on event_id IS the atomic-consumption
-- mechanism, exactly like consumed_nonces's primary key on nonce (see
-- 20260718090000_add_nonce_and_caller_audit_tables.sql): two concurrent
-- inserts of the same event id race at the database, and exactly one
-- succeeds — the other fails with a 23505 unique_violation, which
-- SupabaseRazorpayWebhookEventStore maps to "already consumed" (returns
-- false) rather than a thrown failure. A row here only ever exists for a
-- request whose HMAC signature has already been verified — see
-- routes/webhooks-razorpay.ts's verify-then-consume ordering.
--
-- payload is the raw JSON body, stored verbatim for M4b to parse in full;
-- this table's own indexed columns (event_id, event_type) exist purely for
-- lookup/routing, not as a substitute for re-parsing the payload.

CREATE TABLE IF NOT EXISTS razorpay_webhook_events (

    event_id TEXT PRIMARY KEY,

    -- The verified payload's top-level `event` field (e.g.
    -- "refund.processed"), when present and a string. Not authoritative on
    -- its own — M4b re-parses `payload` in full.
    event_type TEXT,

    payload TEXT NOT NULL,

    received_at TIMESTAMPTZ NOT NULL,

    inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_received_at
ON razorpay_webhook_events (
    received_at
);

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_event_type
ON razorpay_webhook_events (
    event_type
);

ALTER TABLE razorpay_webhook_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- razorpay_webhook_audit_events
-- -----------------------------------------------------------------------------
--
-- Append-only. Mirrors packages/api/src/webhooks/RazorpayWebhookAuditSink.ts's
-- RazorpayWebhookAuditEvent shape exactly. Deliberately narrow, matching this
-- session's payload-handling rule (treat the body as untrusted input even
-- post-verification): event_id, event_type, payment_id, and refund_id are the
-- only payload-derived fields ever written here — no full payload contents,
-- no card/customer fields Razorpay's payload may include. reason is one of a
-- fixed set of short diagnostic strings ("missing signature header",
-- "invalid signature", "missing event id header") — no signature or secret
-- material.

CREATE TABLE IF NOT EXISTS razorpay_webhook_audit_events (

    id BIGSERIAL PRIMARY KEY,

    type TEXT NOT NULL
        CHECK (type IN ('webhook.received', 'webhook.duplicate', 'webhook.rejected')),

    occurred_at TIMESTAMPTZ NOT NULL,

    route TEXT NOT NULL,

    -- Present once the signature has verified (received, duplicate, or a
    -- post-verification rejection such as a missing event id header).
    event_id TEXT,

    event_type TEXT,
    payment_id TEXT,
    refund_id TEXT,

    -- Present only for type = 'webhook.rejected'.
    reason TEXT,

    inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_audit_events_occurred_at
ON razorpay_webhook_audit_events (
    occurred_at
);

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_audit_events_event_id
ON razorpay_webhook_audit_events (
    event_id
);

ALTER TABLE razorpay_webhook_audit_events ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source: supabase/migrations/20260718190412_add_settlement_confirmations_and_audit_severity.sql
-- Settlement confirmations and audit severity (M4b)
-- =============================================================================
--
-- Backs the durable, Supabase-backed settlement-confirmation infrastructure
-- introduced this session: packages/storage/src/supabase/
-- SupabaseExecutionTrustRecordRepository.ts's appendSettlementConfirmation,
-- and two new columns/values on the M4a webhook audit trail
-- (20260718182238_add_razorpay_webhook_tables.sql) to record settlement
-- PROCESSING outcomes, not just webhook DELIVERY outcomes.

-- -----------------------------------------------------------------------------
-- settlement_confirmations
-- -----------------------------------------------------------------------------
--
-- Append-only, mirrors the receipts table's shape exactly (see
-- 20260629013035_initial_schema.sql) — one row per SettlementConfirmation,
-- the full signed artifact stored verbatim in confirmation_json, plus a few
-- indexed columns for lookup. A row here is never mutated or deleted: the
-- Execution Trust Record's own trustRecordHash/signature and every existing
-- Receipt remain exactly as they were before this table existed.

CREATE TABLE IF NOT EXISTS settlement_confirmations (

    confirmation_id TEXT PRIMARY KEY,

    business_transaction_id TEXT NOT NULL,

    confirmation_json JSONB NOT NULL,

    issued_at TIMESTAMPTZ NOT NULL,

    seq BIGSERIAL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE INDEX IF NOT EXISTS idx_settlement_confirmations_business_transaction_id
ON settlement_confirmations (
    business_transaction_id
);

ALTER TABLE settlement_confirmations ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- razorpay_webhook_audit_events: settlement processing outcomes
-- -----------------------------------------------------------------------------
--
-- Widens the type CHECK constraint from 20260718182238 to add the four
-- settlement.* outcomes (settlement processing is a separate, out-of-band
-- step from webhook delivery — see packages/api/src/webhooks/
-- RazorpaySettlementProcessor.ts), and adds severity (elevated-severity
-- marker for settlement.failed / settlement.park_exhausted — "a refund's
-- lifecycle did not close cleanly," never silence), confirmation_id, and
-- fetched_refund_status (the fetch-verified, not webhook-claimed, status).

ALTER TABLE razorpay_webhook_audit_events
DROP CONSTRAINT IF EXISTS razorpay_webhook_audit_events_type_check;

ALTER TABLE razorpay_webhook_audit_events
ADD CONSTRAINT razorpay_webhook_audit_events_type_check
CHECK (type IN (
    'webhook.received',
    'webhook.duplicate',
    'webhook.rejected',
    'settlement.confirmed',
    'settlement.failed',
    'settlement.parked',
    'settlement.park_exhausted'
));

ALTER TABLE razorpay_webhook_audit_events
ADD COLUMN IF NOT EXISTS severity TEXT;

ALTER TABLE razorpay_webhook_audit_events
ADD COLUMN IF NOT EXISTS confirmation_id TEXT;

ALTER TABLE razorpay_webhook_audit_events
ADD COLUMN IF NOT EXISTS fetched_refund_status TEXT;

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_audit_events_severity
ON razorpay_webhook_audit_events (
    severity
)
WHERE severity IS NOT NULL;


-- =============================================================================
-- Source: supabase/migrations/20260802120000_add_refusal_records.sql
-- RFC-0021
-- Refusal Records: durable, signed, third-party-verifiable evidence
-- of a policy REJECT.
-- =============================================================================
--
-- Scope is deliberately narrow: this table holds evidence for
-- PolicyEngine.evaluate REJECTs and SignalIntentBinder
-- binding-violation REJECTs only (see RuntimeEngine.execute()'s
-- writeRefusalRecord() call site) -- not caller-auth failures or
-- webhook signature failures (a separate, unsigned audit-sink
-- milestone: caller_audit_events / razorpay_webhook_audit_events).
--
-- signature_json is NOT NULL, unlike execution_trust_records'
-- (added later, nullable, via a retrofit migration) -- Refusal
-- Records ship signed from the start, no retrofit period.

CREATE TABLE IF NOT EXISTS refusal_records (

    refusal_record_id TEXT PRIMARY KEY,

    business_transaction_id TEXT NOT NULL UNIQUE,

    decision_json JSONB NOT NULL,

    evaluated_intent_json JSONB NOT NULL,

    binding_violations_json JSONB,

    submitted_by TEXT,

    refusal_record_hash TEXT NOT NULL,

    signature_json JSONB NOT NULL,

    -- Retention: currently indefinite, same policy as
    -- execution_trust_records. Revisit if REJECT volume ever grows
    -- significantly (RFC-0021 Open Question 3) -- not addressed by
    -- this migration.
    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_refusal_transaction
        FOREIGN KEY (
            business_transaction_id
        )
        REFERENCES business_transactions(
            business_transaction_id
        )
        ON DELETE RESTRICT

);

CREATE INDEX IF NOT EXISTS idx_refusal_records_created_at
ON refusal_records (
    created_at
);

ALTER TABLE refusal_records ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source: supabase/migrations/20260802130000_sign_audit_events.sql
-- Audit-sink signing milestone (follows RFC-0021's Refusal Records)
-- =============================================================================
--
-- Adds a signature to the two existing durable audit trails
-- (caller_audit_events, razorpay_webhook_audit_events). Previously
-- these were plain rows: durable, but anyone with database access
-- could alter one with no way to detect it. SupabaseCallerAuditSink
-- and SupabaseRazorpayWebhookAuditSink now sign every event at write
-- time with the same key (DEFAULT_KEY_ID) ExecutionTrustRecord and
-- RefusalRecord already use — see @parmana/crypto's AuditEventCrypto.
--
-- Nullable, matching execution_trust_records.signature_json's own
-- precedent: both tables already had rows before this migration, and
-- this is additive, not a backfill. Existing rows remain unsigned,
-- honestly — every row written from here forward is signed.
--
-- Scope note: this does NOT cover policy/binding REJECTs
-- (PolicyEngine.evaluate, SignalIntentBinder) — those are
-- refusal_records (RFC-0021), a separate table and milestone.

ALTER TABLE caller_audit_events
ADD COLUMN IF NOT EXISTS signature_json JSONB;

ALTER TABLE razorpay_webhook_audit_events
ADD COLUMN IF NOT EXISTS signature_json JSONB;


-- =============================================================================
-- Source: supabase/migrations/20260803150000_add_challenge_records.sql
-- RFC-0022
-- Challenge Records: a durable, structured trace from "an assumption
-- was questioned" to "what changed because of it."
-- =============================================================================
--
-- Deliberately NOT signed (RFC-0022 § Proposal 3 -- no signature_json
-- column here, unlike refusal_records/execution_trust_records). A
-- ChallengeRecord is evidence of an organizational process, not a
-- runtime transaction outcome; the party who could misrepresent it is
-- the same party who writes it, so a signature would prove
-- tamper-evidence of bytes-on-disk while leaving the actual trust
-- question (was the investigation honest) unaddressed. Trustworthy
-- instead through citation discipline and, where applicable, public
-- disclosure -- see the domain type's own doc comment
-- (packages/shared/src/domain/challenge-record.ts).
--
-- Unlike refusal_records (a single terminal row per transaction), a
-- Challenge Record is investigated over real time: investigation_
-- steps_json accumulates and status/finding/outcome/disclosure are
-- set via UPDATE as the investigation proceeds
-- (PostgresChallengeRecordRepository.append), enforced append-only at
-- the application layer (applyChallengeRecordAppend), not by any
-- database-level trigger or constraint -- this table has no unique
-- business-transaction relationship to key off of the way
-- refusal_records does, since a challenge need not be about any one
-- transaction at all.
--
-- No PostgREST/supabase-js dependency for this table's application
-- code (PostgresChallengeRecordRepository writes via a direct
-- Postgres connection, per the audit-sink signing milestone's own
-- workaround) -- this migration itself is still applied the normal
-- way, through the Supabase project's own Postgres, identically to
-- every other table in this directory.

CREATE TABLE IF NOT EXISTS challenge_records (

    challenge_record_id TEXT PRIMARY KEY,

    status TEXT NOT NULL
        CHECK (status IN ('open', 'investigating', 'resolved')),

    claim_challenged TEXT NOT NULL,

    source_json JSONB NOT NULL,

    investigation_steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,

    finding_json JSONB,

    outcome_json JSONB,

    disclosure_json JSONB,

    -- The prior challenge_record_id this one supersedes/follows up
    -- on. No FK constraint: deliberately tolerant of a superseded
    -- record being pruned independently in the future (retention
    -- policy is an open question, RFC-0022 Open Question 2), and a
    -- forward reference would otherwise have to be nullable/deferred
    -- anyway for the common "no prior record" case.
    supersedes TEXT,

    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL

);

CREATE INDEX IF NOT EXISTS idx_challenge_records_status
ON challenge_records (
    status
);

CREATE INDEX IF NOT EXISTS idx_challenge_records_created_at
ON challenge_records (
    created_at
);

ALTER TABLE challenge_records ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source: supabase/migrations/20260805170000_add_razorpay_daily_refund_reservations.sql
-- Razorpay daily cumulative refund reservation ledger (TD-23 closure, Phase 3B)
-- =============================================================================
--
-- Backs RazorpayDailyRefundLedger's atomic reserve()/release() operations
-- (packages/storage/src/supabase/SupabaseRazorpayDailyRefundLedger.ts).
--
-- Closes an independently-verified gap (Phase 2L, Phase 3A): the
-- razorpay-refund/1.0.0 policy's daily cumulative cap was previously
-- enforced against a caller-declared signal
-- (dailyCumulativeAfterThisRefundPaise) with no independent verification --
-- a caller could declare any value regardless of real refund history.
--
-- This is a single-row-per-day atomic counter, not a transaction ledger or a
-- duplicate of Trust Record history: it stores nothing about individual
-- refunds, only a running total per UTC calendar day. The authoritative
-- record of what actually executed remains the existing executions table
-- (see ExecutionTrustRecordRepository.sumSuccessfulExecutionAmounts, added
-- alongside this migration for reconciliation/observability) -- this table
-- exists solely to make "read the current total, then decide, then commit"
-- atomic across concurrent requests, which a SELECT-then-write over the
-- executions table cannot be, since a real Razorpay API call (which cannot
-- be wrapped in a database transaction) sits between the decision and the
-- executions row that would eventually record it.
--
-- Atomicity: reserve() is a single INSERT ... ON CONFLICT (refund_day) DO
-- UPDATE ... RETURNING statement. Two concurrent reservations for the same
-- day are serialized by Postgres's own row lock on that day's row -- the
-- same class of atomicity consumed_nonces's and razorpay_webhook_events's
-- primary keys already provide for uniqueness checks, applied here to an
-- additive counter instead.

CREATE TABLE IF NOT EXISTS razorpay_daily_refund_reservations (

    refund_day DATE PRIMARY KEY,

    reserved_paise BIGINT NOT NULL DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT chk_reserved_paise_non_negative CHECK (reserved_paise >= 0)

);

ALTER TABLE razorpay_daily_refund_reservations ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source: supabase/migrations/20260805180000_add_consumed_approval_nonces.sql
-- Approval Artifact replay protection (TD-23 closure, Phase 3C)
-- =============================================================================
--
-- Backs SupabaseApprovalNonceStore's atomic checkAndRecord()
-- (packages/storage/src/supabase/SupabaseApprovalNonceStore.ts), the
-- durable NonceStore ApprovalVerifier uses to enforce that a Signed
-- Approval Artifact is consumed at most once.
--
-- Deliberately a separate table from consumed_nonces
-- (20260718090000_add_nonce_and_caller_audit_tables.sql), not a shared
-- one: an Approval Artifact's nonce and a Gateway Authorization
-- envelope's nonce are distinct trust domains issued by distinct
-- parties (an external business approver vs. Parmana's own runtime).
-- Sharing one table would let a coincidental nonce collision between
-- the two unrelated namespaces falsely report "already consumed" for
-- one because of the other.
--
-- Same shape, same atomicity mechanism, same reasoning as
-- consumed_nonces: append-only, the PRIMARY KEY on nonce IS the
-- atomic-consumption mechanism (two concurrent inserts of the same
-- nonce race at the database; exactly one succeeds, the other fails
-- with a 23505 unique_violation, mapped to "already consumed"). No
-- PII: a nonce is an opaque, single-use token chosen by the artifact's
-- issuer, not an identifier.

CREATE TABLE IF NOT EXISTS consumed_approval_nonces (

    nonce TEXT PRIMARY KEY,

    -- From the artifact's own expiresAt (NonceStore.checkAndRecord's
    -- second argument). Not currently read back by application code;
    -- kept for a future retention/cleanup job, mirroring
    -- consumed_nonces.expires_at's own residual note.
    expires_at TIMESTAMPTZ NOT NULL,

    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE INDEX IF NOT EXISTS idx_consumed_approval_nonces_expires_at
ON consumed_approval_nonces (
    expires_at
);

ALTER TABLE consumed_approval_nonces ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source: supabase/migrations/20260812120000_add_capability_to_caller_audit_events.sql
-- Caller-capability-scoping audit trail (caller-to-capability scoping)
-- =============================================================================
--
-- Backs CallerAuditEvent's new "caller.capability_denied" type and
-- `capability` field (packages/api/src/auth/CallerAuditSink.ts,
-- packages/api/src/routes/execute.ts / transactions.ts): an
-- authenticated caller attempting a capability outside its
-- ApiKeyEntry.allowedCapabilities is denied, and that denial is
-- audited the same way a missing/invalid credential already is.
--
-- Widens the type CHECK constraint from 20260718090000 to add the
-- new event type, mirroring 20260718190412's DROP/ADD CONSTRAINT
-- pattern for razorpay_webhook_audit_events. Adds `capability`,
-- nullable and additive like every prior column addition to this
-- table (signature_json, 20260802130000) -- existing rows are
-- unaffected, every row written from here forward that concerns a
-- specific capability carries it.

ALTER TABLE caller_audit_events
DROP CONSTRAINT IF EXISTS caller_audit_events_type_check;

ALTER TABLE caller_audit_events
ADD CONSTRAINT caller_audit_events_type_check
CHECK (type IN (
    'caller.authenticated',
    'caller.rejected',
    'caller.capability_denied'
));

ALTER TABLE caller_audit_events
ADD COLUMN IF NOT EXISTS capability TEXT;

CREATE INDEX IF NOT EXISTS idx_caller_audit_events_capability
ON caller_audit_events (
    capability
)
WHERE capability IS NOT NULL;

-- =============================================================================
-- Source: supabase/migrations/20260816120000_add_principal_to_caller_audit_events.sql
-- Caller-principal-binding audit trail (caller-to-principal scoping)
-- =============================================================================

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

-- =============================================================================
-- Source: supabase/migrations/20260818120000_add_policy_governance_tables.sql
-- Policy Governance (maker-checker)
-- =============================================================================

CREATE TABLE IF NOT EXISTS pending_policy_changes (

    pending_policy_change_id TEXT PRIMARY KEY,

    policy_name TEXT NOT NULL,

    policy_version TEXT NOT NULL,

    proposed_content_json JSONB NOT NULL,

    proposed_by TEXT NOT NULL,

    proposed_at TIMESTAMPTZ NOT NULL,

    status TEXT NOT NULL CHECK (
        status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')
    ),

    reason TEXT NOT NULL,

    resolved_by TEXT,

    resolved_at TIMESTAMPTZ,

    rejection_reason TEXT

);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pending_policy_changes_open
ON pending_policy_changes (
    policy_name,
    policy_version
)
WHERE status = 'PENDING_APPROVAL';

CREATE INDEX IF NOT EXISTS idx_pending_policy_changes_status
ON pending_policy_changes (
    status
);

ALTER TABLE pending_policy_changes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS policy_change_approval_records (

    policy_change_approval_record_id TEXT PRIMARY KEY,

    pending_policy_change_id TEXT NOT NULL
        REFERENCES pending_policy_changes(pending_policy_change_id)
        ON DELETE RESTRICT,

    policy_name TEXT NOT NULL,

    policy_version TEXT NOT NULL,

    proposed_by TEXT NOT NULL,

    approved_by TEXT NOT NULL,

    proposed_at TIMESTAMPTZ NOT NULL,

    approved_at TIMESTAMPTZ NOT NULL,

    content_hash_before TEXT,

    content_hash_after TEXT NOT NULL,

    signature_json JSONB NOT NULL

);

CREATE INDEX IF NOT EXISTS idx_policy_change_approval_records_policy
ON policy_change_approval_records (
    policy_name,
    policy_version,
    approved_at DESC
);

ALTER TABLE policy_change_approval_records ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source: supabase/migrations/20260818130000_add_non_human_denied_to_caller_audit_events.sql
-- Non-human-caller-denied audit trail (Policy Governance, maker-checker)
-- =============================================================================

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


-- =============================================================================
-- Source: supabase/migrations/20260818140000_add_consumed_policy_change_step_up_nonces.sql
-- Policy Change Step-Up Authorization replay protection (Policy
-- Governance, maker-checker, Layer 4)
-- =============================================================================

CREATE TABLE IF NOT EXISTS consumed_policy_change_step_up_nonces (

    nonce TEXT PRIMARY KEY,

    expires_at TIMESTAMPTZ NOT NULL,

    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()

);

CREATE INDEX IF NOT EXISTS idx_consumed_policy_change_step_up_nonces_expires_at
ON consumed_policy_change_step_up_nonces (
    expires_at
);

ALTER TABLE consumed_policy_change_step_up_nonces ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Source: supabase/migrations/20260818150000_add_ci_read_only_policy_for_approval_records.sql
-- CI read-only access to Policy Change Approval Records (Policy
-- Governance, maker-checker, preventive CI/deploy-time gate)
-- =============================================================================

GRANT SELECT ON policy_change_approval_records TO anon;

DROP POLICY IF EXISTS "ci_read_only_select" ON policy_change_approval_records;

CREATE POLICY "ci_read_only_select" ON policy_change_approval_records
    FOR SELECT
    TO anon
    USING (true);


-- =============================================================================
-- Source: supabase/migrations/20260824090000_add_structural_rejected_to_caller_audit_events.sql
-- Structural-validation rejection audit trail (G-29)
-- =============================================================================

ALTER TABLE caller_audit_events
DROP CONSTRAINT IF EXISTS caller_audit_events_type_check;

ALTER TABLE caller_audit_events
ADD CONSTRAINT caller_audit_events_type_check
CHECK (type IN (
    'caller.authenticated',
    'caller.rejected',
    'caller.capability_denied',
    'caller.principal_denied',
    'caller.non_human_denied',
    'caller.structural_rejected'
));

ALTER TABLE caller_audit_events
ADD COLUMN IF NOT EXISTS business_transaction_id TEXT;

CREATE INDEX IF NOT EXISTS idx_caller_audit_events_business_transaction_id
ON caller_audit_events (
    business_transaction_id
)
WHERE business_transaction_id IS NOT NULL;
