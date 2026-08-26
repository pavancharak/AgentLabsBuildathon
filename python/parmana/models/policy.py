"""
GENERATED FILE -- DO NOT EDIT BY HAND.

Generated from packages/shared/src/domain/policy-reference.ts by
python/scripts/generate_models.ts. Run "npm run
generate:python-models" to regenerate.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PolicyReference:
    name: str

    version: str

    schema_version: str

    content_hash: str | None = None
