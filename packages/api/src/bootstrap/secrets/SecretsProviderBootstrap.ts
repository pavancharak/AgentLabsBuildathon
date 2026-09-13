import { SecretsProviders, loadConfig } from "@parmana/shared";

import type { SecretsProvider } from "./SecretsProvider.js";
import { EnvSecretsProvider } from "./EnvSecretsProvider.js";
import { AwsSecretsManagerProvider } from "./AwsSecretsManagerProvider.js";

/**
 * Secrets Provider Bootstrap (ADR-0009).
 *
 * Composition root for SecretsProvider, mirroring
 * @parmana/crypto's SignerBootstrap exactly: a memoized static
 * singleton, selected by PARMANA_SECRETS_PROVIDER.
 */
export class SecretsProviderBootstrap {
  private static provider: SecretsProvider | undefined;

  static async create(): Promise<SecretsProvider> {
    if (!this.provider) {
      const configuredProvider = loadConfig().secrets.provider;

      if (configuredProvider === SecretsProviders.ENV) {
        this.provider = new EnvSecretsProvider();
      } else if (configuredProvider === SecretsProviders.AWS_SECRETS_MANAGER) {
        this.provider = await AwsSecretsManagerProvider.create();
      } else {
        throw new Error(
          `PARMANA_SECRETS_PROVIDER=${configuredProvider} is not implemented.`,
        );
      }
    }

    return this.provider;
  }
}
