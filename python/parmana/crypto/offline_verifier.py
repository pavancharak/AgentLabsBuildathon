"""
Standalone, offline verification of an Execution Trust Record.

Python counterpart to packages/crypto/src/OfflineVerifier.ts (PQC
audit RED-1, docs/VERIFICATION-GAPS.md) -- proves the canonical
serialization algorithm and Ed25519 verification are independently
reproducible in a second language, not just documented as "should be
portable." Zero network calls, zero disk reads (beyond files the
caller explicitly passes in), zero environment variables.

ML-DSA-65 (Dilithium3) verification is intentionally out of scope
here: the `cryptography` package version this SDK currently depends
on does not yet expose `cryptography.hazmat.primitives.asymmetric.
ml_dsa`. A hybrid-signed record's `signatures` array cannot be
independently checked from Python until that support lands upstream
and this module is updated to use it -- stated plainly rather than
silently skipped or faked.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.hashes import SHA256, Hash
from cryptography.hazmat.primitives.serialization import load_pem_public_key

from .canonical import canonical_serialize

_SUPPORTED_ALGORITHMS = {"ed25519"}


def _canonical_execution_trust_record(record: dict[str, Any]) -> dict[str, Any]:
    """
    Mirrors ExecutionTrustRecordCanonicalView.ts's
    canonicalExecutionTrustRecord() field-for-field. A field absent
    from `record` (e.g. no `authorization`) is simply omitted here,
    the same as CanonicalSerializer.ts dropping an undefined key via
    JSON.stringify.
    """

    fields_in_order = (
        "trustRecordId",
        "businessTransactionId",
        "transaction",
        "authorization",
        "overrides",
        "executions",
        "createdAt",
    )

    return {key: record[key] for key in fields_in_order if key in record}


@dataclass(frozen=True)
class OfflineVerificationResult:
    valid: bool
    hash_valid: bool
    legacy_signature_valid: bool
    algorithms_checked: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def verify_execution_trust_record_offline(
    trust_record: dict[str, Any],
    public_keys: dict[str, str],
) -> OfflineVerificationResult:
    """
    `trust_record` is a plain dict, exactly as `json.load()` would
    produce from a Trust Record JSON file or API response body.
    `public_keys` maps keyId -> PEM-encoded public key text.
    """

    errors: list[str] = []
    algorithms_checked: list[str] = []

    canonical = _canonical_execution_trust_record(trust_record)
    digest = Hash(SHA256())
    digest.update(canonical_serialize(canonical))
    expected_hash = digest.finalize().hex()

    hash_valid = expected_hash == trust_record.get("trustRecordHash")

    if not hash_valid:
        errors.append(
            f"trustRecordHash mismatch: expected {expected_hash}, "
            f"got {trust_record.get('trustRecordHash')}."
        )

    signature_field = trust_record.get("signature") or {}
    algorithm = signature_field.get("algorithm")
    key_id = signature_field.get("keyId")
    signature_value = signature_field.get("value")

    legacy_signature_valid = False

    if algorithm not in _SUPPORTED_ALGORITHMS:
        errors.append(f"unsupported algorithm: {algorithm}.")
    elif key_id not in public_keys:
        errors.append(f'no public key supplied for keyId "{key_id}".')
    else:
        algorithms_checked.append(algorithm)

        try:
            public_key = load_pem_public_key(public_keys[key_id].encode("utf-8"))

            if not isinstance(public_key, Ed25519PublicKey):
                raise ValueError("supplied public key is not an Ed25519 key")

            if not isinstance(signature_value, str):
                raise ValueError("signature.value is missing or not a string")

            import base64

            signature_bytes = base64.b64decode(signature_value)
            message = canonical_serialize(canonical)

            public_key.verify(signature_bytes, message)
            legacy_signature_valid = True
        except InvalidSignature:
            errors.append(
                f'signature verification failed for keyId "{key_id}" ({algorithm}).'
            )
        except Exception as error:  # noqa: BLE001 -- reported, not swallowed
            errors.append(f'error verifying keyId "{key_id}" ({algorithm}): {error}')

    if trust_record.get("signatures"):
        errors.append(
            "this record carries a hybrid `signatures` array; ML-DSA-65 "
            "verification is not yet available from Python (see this "
            "module's own docstring) -- verify with the TypeScript "
            "reference implementation (packages/crypto/src/"
            "OfflineVerifier.ts) for a complete hybrid check."
        )

    valid = hash_valid and legacy_signature_valid and not trust_record.get("signatures")

    return OfflineVerificationResult(
        valid=valid,
        hash_valid=hash_valid,
        legacy_signature_valid=legacy_signature_valid,
        algorithms_checked=algorithms_checked,
        errors=errors,
    )
