\# 21 – Troubleshooting

This guide describes common issues, their possible causes, and recommended resolutions when working with the Parmana Execution Trust Platform.

\---

\# Overview

Troubleshooting should begin by identifying:

\- The affected component

\- The Business Transaction ID

\- The Trust Record ID (if available)

\- The API endpoint involved

\- Relevant application logs

\---

\# Troubleshooting Workflow

```text

Problem

&#x20;   │

&#x20;   ▼

Identify Component

&#x20;   │

&#x20;   ▼

Collect Logs

&#x20;   │

&#x20;   ▼

Review Trust Record

&#x20;   │

&#x20;   ▼

Verify Cryptographic Evidence

&#x20;   │

&#x20;   ▼

Resolve Issue

&#x20;   │

&#x20;   ▼

Retest

```

\---

\# Authentication Issues

\## Symptom

```json

{

&#x20; "error": "authentication required"

}

```

\### Possible Causes

\- Missing Bearer token

\- Invalid API key

\- Incorrect Authorization header

\- API key not configured

\### Resolution

\- Verify the `Authorization: Bearer <API\_KEY>` header.

\- Confirm the API key exists in the configured key list.

\- Restart the service if configuration has changed.

\---

\# Trust Record Not Found

\## Symptom

```json

{

&#x20; "error": "Execution Trust Record not found."

}

```

\### Possible Causes

\- Incorrect Business Transaction ID

\- Transaction was never executed

\- Repository misconfiguration

\### Resolution

\- Confirm the Business Transaction ID.

\- Verify the transaction completed successfully.

\- Check repository connectivity.

\---

\# Verification Failure

\## Possible Causes

\- Trust Record was modified

\- Signature verification failed

\- Authorization binding missing

\### Resolution

\- Inspect the verification message.

\- Compare the recomputed Trust Record hash.

\- Verify the public key matches the `keyId`.

\- Confirm every approved execution contains an `authorizationId`.

\---

\# Replay Failure

\## Possible Causes

\- Missing Trust Record

\- Corrupted stored data

\- Hash mismatch

\- Invalid signature

\### Resolution

\- Retrieve the Trust Record.

\- Run the `/verify` endpoint.

\- Review the verification results.

\---

\# Receipt Generation Failure

\## Possible Causes

\- Missing Business Transaction

\- Trust Record unavailable

\- Repository failure

\### Resolution

\- Verify the Business Transaction ID.

\- Ensure execution completed successfully.

\- Check repository availability.

\---

\# Connector Failures

\## Symptoms

\- Execution timeout

\- Connector unavailable

\- Unexpected connector response

\### Resolution

\- Verify connector configuration.

\- Check target system availability.

\- Review connector logs.

\---

\# Database Issues

\## Symptoms

\- Slow responses

\- Repository errors

\- Missing records

\### Resolution

\- Verify database connectivity.

\- Check storage capacity.

\- Review database logs.

\- Restore from backup if necessary.

\---

\# Signature Verification Failures

\## Possible Causes

\- Incorrect public key

\- Corrupted Trust Record

\- Incorrect `keyId`

\- Data tampering

\### Resolution

\- Verify the configured public key.

\- Confirm the Trust Record has not been modified.

\- Validate key configuration.

\---

\# Performance Issues

\## Symptoms

\- High API latency

\- Slow verification

\- Delayed execution

\### Resolution

\- Review system metrics.

\- Check database performance.

\- Monitor connector response times.

\- Scale infrastructure if required.

\---

\# Diagnostic Checklist

Before reporting an issue, collect:

\- Business Transaction ID

\- Trust Record ID

\- Verification ID (if applicable)

\- API endpoint

\- Request payload

\- Response payload

\- Timestamp

\- Relevant log entries

\---

\# Escalation Checklist

If the issue cannot be resolved:

\- Preserve logs.

\- Preserve the affected Trust Record.

\- Record the verification result.

\- Capture environment details.

\- Document reproduction steps.

\---

\# Summary

Most operational issues can be diagnosed by tracing the Business Transaction through execution, verification, and the associated Execution Trust Record. The platform's immutable evidence and deterministic verification simplify root cause analysis and support reliable incident investigation.
