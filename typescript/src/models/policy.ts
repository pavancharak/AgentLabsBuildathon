/**
 * Parmana Policy Reference.
 *
 * Versioned policy reference.
 */

export interface PolicyReference {
  readonly name: string;

  readonly version: string;

  readonly schemaVersion: string;
}
