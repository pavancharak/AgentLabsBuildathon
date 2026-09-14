# Session note — Parmana v1.0.0 release resume prompt

Archived from `typescript/resume.md` (2026-07-17 hardening session, Task 2). Originally
written 2026-07-09. No code, docs, or config referenced this file's path; grepped before
moving.

---

Here's a resume prompt you can paste into a new chat later:

---

## Parmana v1.0.0 Release Resume

We are resuming the Parmana v1.0.0 release.

### Completed

- ✅ Parmana Platform architecture finalized.
- ✅ Python SDK v1.0.0 published to PyPI.
- ✅ Python SDK tested in a clean virtual environment.
- ✅ Git tag `v1.0.0` created and pushed for the Python SDK.
- ✅ TypeScript SDK brought to feature parity with the Python SDK:

  - HealthApi
  - ExecutionApi
  - VerificationApi
  - ReplayApi
  - ReceiptApi
  - TransactionApi
  - TrustRecordApi
  - PolicyApi
  - ParmanaClient parity

- ✅ Canonical TypeScript domain models added.
- ✅ All packages build successfully.
- ✅ Full test suite passes (all integration and unit tests are green).
- ✅ Runtime lifecycle finalized as:

  ```
  Execute
      ↓
  Verification (automatic)
      ↓
  Receipt (automatic)
  ```

- ✅ Integration tests updated to match the canonical lifecycle.

### Current status

The only remaining task is publishing the TypeScript SDK to npm.

### Current blocker

`npm login` is blocked because the npm authentication flow is requesting a passkey/OTP that is not completing.

We need to:

1. Resolve npm authentication (legacy login or automation access token).
2. Publish the TypeScript SDK (`v1.0.0`) to npm.
3. Verify installation in a clean Node.js project.
4. Push the final Git tag and create the GitHub Release for Parmana Platform v1.0.0.
5. Prepare release notes and announcement.

Continue from this point without revisiting completed architecture or SDK parity work.

---

This prompt should let us pick up exactly where we left off.
