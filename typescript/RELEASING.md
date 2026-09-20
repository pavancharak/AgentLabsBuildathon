# Releasing the TypeScript SDK

The package is `@parmana/sdk`. Run these from the repository root. The version is `version` in `typescript/package.json`, and the root `package-lock.json` records it for the workspace, so change both.

## 1. Prepare

1. Bump `version` in `typescript/package.json` and the `@parmana/sdk` workspace entry in the root `package-lock.json`.
2. Add a note to `docs/site/changelog.mdx` describing what changed.
3. Make sure CI is green, and run the SDK tests **from the repository root**: `npx vitest run typescript`. The integration tests start a real local API and `PARMANA_POLICY_DIR=./policies` resolves relative to where vitest runs, so running them from `typescript/` fails with "Policy 'vendor-payment' was not found".

## 2. Build and inspect the package

```bash
npm run build --workspace=typescript
npm pack --workspace=typescript --pack-destination /tmp/parmana-npm --dry-run
npm pack --workspace=typescript --pack-destination /tmp/parmana-npm
```

The tarball must contain only `dist/`, `README.md`, `LICENSE` and `package.json`, and it must be named `parmana-sdk-<version>.tgz`.

## 3. Test the packed tarball in a clean project

```bash
mkdir /tmp/parmana-npm-check && cd /tmp/parmana-npm-check
npm init -y
npm install /tmp/parmana-npm/parmana-sdk-<version>.tgz
node --input-type=module -e "import * as sdk from '@parmana/sdk'; console.log(Object.keys(sdk).length, 'exports', typeof sdk.ParmanaClient)"
```

## 4. Publish

Publishing needs an npm account that can publish `@parmana/sdk`, with two factor authentication. Never commit a token.

```bash
npm login
npm publish /tmp/parmana-npm/parmana-sdk-<version>.tgz --access public
```

If your account uses a one time password, add `--otp <code>`.

## 5. After publishing

1. Confirm the version at `https://www.npmjs.com/package/@parmana/sdk` and that `npm view @parmana/sdk version` shows it.
2. Update the published version statements in `docs/site/sdks/typescript.mdx` and the "built but not yet published" wording in `docs/site/changelog.mdx`.
3. Tag the release in git.
