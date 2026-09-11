import { PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET } from "@parmana/connector-paytm";
import {
  StaticCredentialProvider,
  brandCredentialHandle,
  type CredentialHandle,
  type CredentialProvider,
} from "@parmana/connector-sdk";

const PAYTM_CONNECTOR_ID = "paytm";

/**
 * Resolves the Paytm connector's credential: the shared secret Parmana
 * authenticates itself to the trusted, out-of-process Paytm connector
 * service with (PAYTM_CONNECTOR_SHARED_SECRET). This is transport
 * authentication between Parmana and its own connector service — never
 * Paytm's own merchant key, which this codebase never holds.
 *
 * sharedSecret is read from process.env only inside resolve(), held
 * only in the returned CredentialHandle's value, and never placed
 * anywhere else — not logged, not embedded in a thrown error (only the
 * variable name PAYTM_CONNECTOR_SHARED_SECRET ever appears in
 * messages).
 */
class PaytmEnvironmentCredentialProvider implements CredentialProvider {
  readonly providerId = "environment";

  async resolve(connectorId: string): Promise<CredentialHandle> {
    if (connectorId !== PAYTM_CONNECTOR_ID) {
      throw new Error(
        `PaytmEnvironmentCredentialProvider cannot resolve credentials for connector "${connectorId}".`,
      );
    }

    const sharedSecret = process.env.PAYTM_CONNECTOR_SHARED_SECRET;

    if (sharedSecret === undefined) {
      throw new Error(
        `Environment variable PAYTM_CONNECTOR_SHARED_SECRET for connector "${PAYTM_CONNECTOR_ID}" is not set.`,
      );
    }

    return brandCredentialHandle({
      providerId: this.providerId,
      credentialId: "PAYTM_CONNECTOR_SHARED_SECRET",
      value: Object.freeze({ sharedSecret }),
    });
  }
}

/**
 * Creates the Paytm credential provider, or undefined when the
 * paytm:refund capability should not be registered at all.
 *
 * Test (NODE_ENV=test): a static shared secret, overridable via
 * TEST_PAYTM_CONNECTOR_SHARED_SECRET — read directly, with no
 * intermediate bridge variable (see CONNECTOR-BUILD-GUIDE.md §10 on why
 * a bridge variable is never introduced here).
 *
 * Production: PAYTM_CONNECTOR_SHARED_SECRET. If unset, this returns
 * undefined rather than a partially-configured provider or a fallback
 * to mock credentials — createConnectorRegistry.ts does not register
 * the Paytm connector at all in that case. Partial configuration (one
 * of PAYTM_CONNECTOR_URL/PAYTM_CONNECTOR_SHARED_SECRET set without the
 * other) is refused earlier and harder, at process startup — see
 * assertPaytmConnectorConfigured.ts — rather than left for this
 * function to paper over.
 */
export function createPaytmCredentialProvider():
  CredentialProvider | undefined {
  if (process.env.NODE_ENV === "test") {
    return new StaticCredentialProvider({
      [PAYTM_CONNECTOR_ID]: {
        sharedSecret:
          process.env.TEST_PAYTM_CONNECTOR_SHARED_SECRET ??
          PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET,
      },
    });
  }

  if (process.env.PAYTM_CONNECTOR_SHARED_SECRET === undefined) {
    return undefined;
  }

  return new PaytmEnvironmentCredentialProvider();
}
