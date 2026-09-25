"""
Parmana Client.

Main entry point for the Parmana Python SDK.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from parmana.api.audit_api import AuditApi
from parmana.api.caller_api import CallerApi
from parmana.api.execution_api import ExecutionApi
from parmana.api.execution_intent_api import ExecutionIntentApi
from parmana.api.policy_api import PolicyApi
from parmana.api.receipt_api import ReceiptApi
from parmana.api.refusal_api import RefusalApi
from parmana.api.replay_api import ReplayApi
from parmana.api.transaction_api import TransactionApi
from parmana.api.trust_record_api import TrustRecordApi
from parmana.api.verification_api import VerificationApi
from parmana.errors.configuration_error import ConfigurationError
from parmana.transport.http_transport import HttpTransport
from parmana.version import __version__

if TYPE_CHECKING:
    from parmana.models.business_transaction import BusinessTransaction
    from parmana.models.caller import CallerIdentity, PublicKeyInfo
    from parmana.models.execution_intent import (
        ExecutionIntent,
        ExecutionIntentResolution,
    )
    from parmana.models.execution_intent_results import (
        ExecutionIntentView,
        FinalizeExecutionIntentResult,
        ResolveExecutionIntentResult,
        UnfinalizedExecutionIntents,
    )
    from parmana.models.policy_change import PendingPolicyChange
    from parmana.models.policy_change_results import (
        PolicyChangeForReview,
        ProposedPolicyChange,
    )
    from parmana.models.receipt import Receipt
    from parmana.models.refusal_record import RefusalRecord
    from parmana.models.signature import Signature
    from parmana.models.trust_record import ExecutionTrustRecord
    from parmana.models.verification import Verification


class ParmanaClient:
    """
    Parmana SDK Client.

    Parmana ensures AI executes only policy-compliant actions.

    Example
    -------
    >>> client = ParmanaClient(
    ...     endpoint="http://localhost:3000",
    ... )

    >>> trust_record = client.execution.execute(transaction)

    >>> verification = client.verification.verify(
    ...     transaction.business_transaction_id,
    ... )
    """

    DEFAULT_TIMEOUT = HttpTransport.DEFAULT_TIMEOUT

    DEFAULT_MAX_RETRIES = HttpTransport.DEFAULT_MAX_RETRIES

    DEFAULT_BACKOFF_FACTOR = HttpTransport.DEFAULT_BACKOFF_FACTOR

    def __init__(
        self,
        *,
        endpoint: str,
        api_key: str | None = None,
        timeout: int = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        backoff_factor: float = DEFAULT_BACKOFF_FACTOR,
        debug: bool = False,
    ) -> None:
        """
        Create a Parmana SDK client.

        Raises
        ------
        ConfigurationError:
            If `endpoint` is missing or empty. Mirrors
            typescript/src/client/ParmanaClient.ts's identical
            fail-fast check.

        This client is synchronous only. There is no async variant.

        Parameters
        ----------
        endpoint:
            Base URL of the Parmana Runtime.

        api_key:
            Caller bearer key, minted by scripts/generate-api-key.ts. Sent
            as `Authorization: Bearer <api_key>` on every request. Omit
            only against a Runtime started with PARMANA_AUTH_DISABLED=true
            (local development only); every other deployment rejects an
            unauthenticated request with a 401 before a Business
            Transaction is even constructed. See
            /api-reference/authentication.

        timeout:
            HTTP timeout in seconds, applied per request.

        max_retries:
            Retry attempts for idempotent (GET) requests that fail with
            a connection error or a 429/502/503/504 response. POST requests
            (execute, verify, receipt, replay) are never retried.

        backoff_factor:
            Exponential backoff factor between retries, in seconds.

        debug:
            Enable request/response debug logging on the "parmana" logger.
        """

        if not endpoint:
            raise ConfigurationError("Runtime endpoint is required.")

        self._transport = HttpTransport(
            endpoint=endpoint,
            api_key=api_key,
            timeout=timeout,
            max_retries=max_retries,
            backoff_factor=backoff_factor,
            debug=debug,
        )

        #
        # APIs
        #

        self.execution = ExecutionApi(
            self._transport,
        )

        self.verification = VerificationApi(
            self._transport,
        )

        self.replay = ReplayApi(
            self._transport,
        )

        self.receipt = ReceiptApi(
            self._transport,
        )

        self.transactions = TransactionApi(
            self._transport,
        )

        self.trust_records = TrustRecordApi(
            self._transport,
        )

        self.policy = PolicyApi(
            self._transport,
        )

        self.refusal = RefusalApi(
            self._transport,
        )

        self.execution_intents = ExecutionIntentApi(
            self._transport,
        )

        self.audit = AuditApi(
            self._transport,
        )

        self.callers = CallerApi(
            self._transport,
        )

    @property
    def endpoint(self) -> str:
        """
        Parmana Runtime endpoint.
        """
        return self._transport.endpoint

    @property
    def version(self) -> str:
        """
        Parmana SDK version.
        """
        return __version__

    #
    # Canonical flat capabilities (docs/sdk/SDK_CONFORMANCE.md #5:
    # execute(), verify(), replay(), validatePolicy(), health()), plus
    # the other operations typescript/src/client/ParmanaClient.ts
    # exposes at the top level. `replay()`, `receipt()`, and
    # `transactions()` don't need wrapper methods here: those names are
    # already taken by the nested API namespaces above, so those
    # namespace objects were made directly callable instead (see
    # ReplayApi.__call__, ReceiptApi.__call__, TransactionApi.__call__)
    # -- `client.replay(id)` and `client.replay.replay(id)` both work,
    # without breaking either existing call shape.
    #

    def health(self) -> dict[str, Any]:
        """
        Returns the Runtime health status.
        """
        return self.execution.health()

    def execute(self, transaction: BusinessTransaction) -> ExecutionTrustRecord:
        """
        Execute a Business Transaction.
        """
        return self.execution.execute(transaction)

    def verify(self, business_transaction_id: str) -> Verification:
        """
        Run a fresh verification of an Execution Trust Record, appending
        a new Verification to its history. Distinct from
        get_latest_verification(), which reads the most recent one
        without re-verifying.
        """
        return self.verification.verify(business_transaction_id)

    def get_latest_verification(self, business_transaction_id: str) -> Verification:
        """
        Returns the latest Verification, without performing a fresh one.
        """
        return self.verification.get_latest(business_transaction_id)

    def create_transaction(
        self, transaction: BusinessTransaction
    ) -> ExecutionTrustRecord:
        """
        Creates (executes) a Business Transaction via POST /transactions,
        a second, independent entry point into the identical execution
        pipeline as execute() (POST /execute).
        """
        return self.transactions.create(transaction)

    def transaction(self, business_transaction_id: str) -> BusinessTransaction:
        """
        Retrieves a Business Transaction.
        """
        return self.transactions.get(business_transaction_id)

    def trust_record(self, business_transaction_id: str) -> ExecutionTrustRecord:
        """
        Retrieves an Execution Trust Record.
        """
        return self.trust_records.get(business_transaction_id)

    def validate_policy(self, policy_id: str, policy_version: str) -> dict[str, Any]:
        """
        Validates that a policy (name + version) is loadable.
        """
        return self.policy.validate(policy_id, policy_version)

    def refusal_record(self, business_transaction_id: str) -> RefusalRecord:
        """
        Retrieves a Refusal Record by Business Transaction ID.
        """
        return self.refusal.get(business_transaction_id)

    def verify_refusal_record(self, record: RefusalRecord) -> bool:
        """
        Verifies a Refusal Record's signature.
        """
        return self.refusal.verify(record)

    def execution_intent(self, business_transaction_id: str) -> ExecutionIntentView:
        """
        Retrieves an Execution Intent and its status (ADR-0012). The intent is
        the signed statement, stored before an action is released, of what was
        about to be released.
        """
        return self.execution_intents.get(business_transaction_id)

    def verify_execution_intent(self, intent: ExecutionIntent) -> bool:
        """
        Verifies an Execution Intent's hash and signature. Needs no
        credential. True proves the intent is genuine and unaltered. It does
        not prove the action was released, or what its result was.
        """
        return self.execution_intents.verify(intent)

    def unfinalized_execution_intents(
        self, limit: int | None = None
    ) -> UnfinalizedExecutionIntents:
        """
        Lists Execution Intents that never reached a signed Trust Record and
        were not closed by hand, oldest first. Needs a credential provisioned
        as a verified human.
        """
        return self.execution_intents.list_unfinalized(limit)

    def finalize_execution_intent(
        self, business_transaction_id: str
    ) -> FinalizeExecutionIntentResult:
        """
        Rebuilds the signed Trust Record for a released action whose record
        was never produced. Never calls a connector. Safe to run twice. Needs
        a credential provisioned as a verified human.
        """
        return self.execution_intents.finalize(business_transaction_id)

    def resolve_execution_intent(
        self,
        business_transaction_id: str,
        *,
        resolution: ExecutionIntentResolution | str,
        note: str,
    ) -> ResolveExecutionIntentResult:
        """
        Closes a PREPARED or ERRORED intent that a verified human reconciled at
        the connector. The note is required. The resolution is an attributed
        operator statement in unsigned status, not a Trust Record.
        """
        return self.execution_intents.resolve(
            business_transaction_id, resolution=resolution, note=note
        )

    def verify_audit_event(self, event: dict[str, Any], signature: Signature) -> bool:
        """
        Verifies a signed caller-authentication or Razorpay-webhook
        audit event's signature.
        """
        return self.audit.verify(event, signature)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"endpoint='{self.endpoint}', "
            f"version='{self.version}')"
        )

    def latest_receipt(self, business_transaction_id: str) -> Receipt:
        """
        Retrieve the most recent receipt without generating a new one.
        See ReceiptApi.get_latest.
        """

        return self.receipt.get_latest(business_transaction_id)

    def caller(self) -> CallerIdentity:
        """
        Who this API key belongs to and what it may do (GET /callers/me).
        """

        return self.callers.me()

    def public_key(self, key_id: str = "default") -> PublicKeyInfo:
        """
        A signing public key of the deployment (GET /keys/{keyId}), for the
        offline verifiers. Records are signed with "default".
        """

        return self.callers.public_key(key_id)

    def propose_policy_change(
        self,
        name: str,
        version: str,
        *,
        proposed_content: dict[str, Any],
        reason: str,
    ) -> ProposedPolicyChange:
        """
        Propose a policy change. See PolicyApi.propose_change.
        """

        return self.policy.propose_change(
            name, version, proposed_content=proposed_content, reason=reason
        )

    def policy_changes(self, status: str | None = None) -> list[PolicyChangeForReview]:
        """
        List policy changes for review. See PolicyApi.list_changes.
        """

        return self.policy.list_changes(status)

    def approve_policy_change(
        self,
        pending_policy_change_id: str,
        step_up_authorization: dict[str, Any],
    ) -> PendingPolicyChange:
        """
        Approve a policy change with a signed step up authorization. See
        PolicyApi.approve_change and parmana.crypto.sign_policy_change_step_up.
        """

        return self.policy.approve_change(
            pending_policy_change_id, step_up_authorization
        )

    def reject_policy_change(
        self,
        pending_policy_change_id: str,
        rejection_reason: str,
        step_up_authorization: dict[str, Any],
    ) -> PendingPolicyChange:
        """
        Reject a policy change with a reason and a signed step up
        authorization. See PolicyApi.reject_change.
        """

        return self.policy.reject_change(
            pending_policy_change_id, rejection_reason, step_up_authorization
        )
