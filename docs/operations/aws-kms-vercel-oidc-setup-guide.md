# AWS KMS + Vercel OIDC Setup Guide (Gateway Signing Key)

> **Status of this document: a how-to, verified against real commands run
> 2026-09-15/16.** Every command below was actually executed against this
> project's real AWS account (`013659367671`, `ap-south-1`) and real Vercel
> project (`pavan-dev-singh-charaks-projects/parmana-api-real`) while
> standing this up for the first time. It is not a theoretical writeup. If
> you are doing this for a **new** project/account, substitute your own
> account ID, region, and Vercel team/project slugs throughout — the shape
> of every command stays the same.
>
> Companion document: `docs/operations/2026-09-15-kms-migration-troubleshooting-guide.md`
> covers what went wrong doing this the first time and how each issue was
> diagnosed — read that one if something here doesn't work as described.
> Design rationale lives in `docs/adr/ADR-0009-KMS-Secrets-And-Connector-Signature-Hardening.md`.

## What this achieves

Parmana's gateway signing key (the Ed25519 key that signs every Execution
Authorization, Trust Record, Refusal Record, and Attestation) moves from a
plaintext PEM file on disk / in `PARMANA_KEY_MATERIAL_JSON` to AWS KMS,
which never releases private key material — a fully compromised process can
request signatures but cannot exfiltrate the key. The deployed Vercel
Function authenticates to AWS with **no static AWS credentials at all**:
it exchanges Vercel's own per-request OIDC token for short-lived AWS
credentials via `AssumeRoleWithWebIdentity`.

Two separate AWS identities get created in this guide, deliberately:

1. **A local-admin IAM user** (`parmana-kms-operator` in this project) —
   for you, the human operator, to run AWS CLI commands from your own
   machine (create the key, inspect it, etc.). Scoped narrowly, never used
   by the deployed application.
2. **An IAM role assumed via Vercel OIDC** (`parmana-vercel-kms-signer` in
   this project) — this is what the deployed Vercel Function actually
   uses at runtime. No access keys, no secrets stored in Vercel at all for
   this purpose.

Do not conflate the two. Production should never authenticate to AWS with
the local-admin user's credentials.

## Prerequisites

- AWS CLI **2.32.0 or later** (`aws --version`) — required for `aws login`'s
  short-term-credential flow. If you're below this, update first; do not
  fall back to `aws configure` with long-term access keys unless you have
  no other option (see the `signing-in-to-aws` guidance on why).
- Vercel CLI (`npm i -g vercel` if not already installed).
- You (or whoever runs this) needs sufficient IAM permissions in the AWS
  account to create IAM users, policies, roles, OIDC providers, and KMS
  keys. In this project that meant using the AWS account **root** user for
  the one-time IAM-creation steps, then never using it again.

## Part 1 — Local admin identity (`parmana-kms-operator`)

All of Part 1 runs as the AWS account root user (or an existing
administrator identity if you have one — root was used here only because
no other admin identity existed yet in a brand-new account).

### 1.1 Sign in

```
aws login --profile parmana
```

(`aws login` opens a browser; short-term credentials, auto-rotating every
15 minutes, valid up to 12 hours — never long-term access keys. See
`aws --version` note above.)

```
aws sts get-caller-identity --profile parmana --region ap-south-1
```

Confirm the `Arn` ends in `:root` (or your admin identity) before
proceeding.

### 1.2 Create the IAM user and its policy

```
aws iam create-user --user-name parmana-kms-operator --profile parmana \
  --tags Key=purpose,Value=parmana-kms-signing
```

Write a least-privilege policy document (adjust the account ID/region;
`YOUR_KEY_ARN` doesn't exist yet at this point, so the first version is
intentionally broader — Part 1.4 tightens it once the key exists):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CreateEd25519SigningKeyOnly",
      "Effect": "Allow",
      "Action": "kms:CreateKey",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:KeySpec": "ECC_NIST_EDWARDS25519",
          "kms:KeyUsage": "SIGN_VERIFY"
        }
      }
    },
    {
      "Sid": "KeyManagement",
      "Effect": "Allow",
      "Action": [
        "kms:CreateAlias",
        "kms:TagResource",
        "kms:ListAliases",
        "kms:ListKeys"
      ],
      "Resource": "*"
    },
    {
      "Sid": "UseSigningKeyTemporary",
      "Effect": "Allow",
      "Action": [
        "kms:DescribeKey",
        "kms:GetPublicKey",
        "kms:Sign",
        "kms:Verify"
      ],
      "Resource": "*"
    }
  ]
}
```

> Sid values must be alphanumeric only (no `-`/`_`) — `MalformedPolicyDocument`
> otherwise.

```
aws iam create-policy --policy-name parmana-kms-signer-policy \
  --policy-document file://policy.json --profile parmana

aws iam attach-user-policy --user-name parmana-kms-operator \
  --policy-arn "arn:aws:iam::YOUR_ACCOUNT_ID:policy/parmana-kms-signer-policy" \
  --profile parmana

aws iam attach-user-policy --user-name parmana-kms-operator \
  --policy-arn "arn:aws:iam::aws:policy/SignInLocalDevelopmentAccess" \
  --profile parmana
```

The `SignInLocalDevelopmentAccess` managed policy is required for this user
to be usable with `aws login` at all (root doesn't need it; any non-root
identity does).

### 1.3 Set a console password and switch to the user

`aws iam create-login-profile` prints a plaintext password — **do this
yourself in the AWS Console** (IAM → Users → parmana-kms-operator →
Security credentials → Console password), not via a script, so the
password never passes through any automation/transcript. Check "require
reset on next sign-in".

Then:

```
aws login --profile parmana
```

**Important:** if your browser has an active root session, `aws login`
may silently reuse it instead of prompting you to choose an identity. If
it doesn't prompt, use an incognito/private window and sign in explicitly
as the IAM user (account ID + username + password). Confirm with:

```
aws sts get-caller-identity --profile parmana --region ap-south-1
```

The `Arn` should now be `arn:aws:iam::YOUR_ACCOUNT_ID:user/parmana-kms-operator`.

## Part 2 — Create the KMS key

Run as `parmana-kms-operator` (Part 1.3's identity).

```
aws kms create-key --key-spec ECC_NIST_EDWARDS25519 --key-usage SIGN_VERIFY \
  --description "Parmana Ed25519 signing key" \
  --profile parmana --region ap-south-1
```

Note the returned `KeyId` (a UUID) and construct the key ARN:
`arn:aws:kms:REGION:ACCOUNT_ID:key/KEY_ID`.

Create **two** aliases pointing at the same key:

```
aws kms create-alias --alias-name alias/parmana-ed25519-signer \
  --target-key-id YOUR_KEY_ID --profile parmana --region ap-south-1

aws kms create-alias --alias-name alias/default \
  --target-key-id YOUR_KEY_ID --profile parmana --region ap-south-1
```

**`alias/default` is not optional or cosmetic.** `KmsSigner`
(`packages/crypto/src/providers/signer/KmsSigner.ts`) maps every logical
keyId this codebase uses (`DEFAULT_KEY_ID = "default"`, see
`packages/crypto/src/KeyProvider.ts`) to `alias/<keyId>` before calling
AWS — without `alias/default` existing, every signing/verification call
fails with `NotFoundException`. See the troubleshooting guide's first
entry for the full story of why this mapping exists at all.

## Part 3 — Tighten the operator's policy (requires root again)

Now that the key exists, remove `kms:CreateKey` and scope everything to
the specific key ARN. This step needs root/admin again (`parmana-kms-operator`
deliberately cannot modify its own IAM policy — that would be a privilege
escalation vector).

```
aws login --profile parmana   # sign in as root this time
```

Update the policy document to:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageThisSigningKey",
      "Effect": "Allow",
      "Action": [
        "kms:TagResource",
        "kms:UntagResource",
        "kms:CreateAlias",
        "kms:DeleteAlias",
        "kms:DescribeKey"
      ],
      "Resource": [
        "arn:aws:kms:REGION:ACCOUNT_ID:key/YOUR_KEY_ID",
        "arn:aws:kms:REGION:ACCOUNT_ID:alias/default",
        "arn:aws:kms:REGION:ACCOUNT_ID:alias/parmana-ed25519-signer"
      ]
    },
    {
      "Sid": "ListKeysReadOnly",
      "Effect": "Allow",
      "Action": ["kms:ListAliases", "kms:ListKeys"],
      "Resource": "*"
    },
    {
      "Sid": "UseThisSigningKeyOnly",
      "Effect": "Allow",
      "Action": ["kms:GetPublicKey", "kms:Sign", "kms:Verify"],
      "Resource": "arn:aws:kms:REGION:ACCOUNT_ID:key/YOUR_KEY_ID"
    }
  ]
}
```

> `kms:CreateAlias` needs the **alias** ARN in `Resource`, not just the key
> ARN — a common source of a confusing `AccessDeniedException` if you scope
> only the key.

```
aws iam create-policy-version --policy-arn "arn:aws:iam::ACCOUNT_ID:policy/parmana-kms-signer-policy" \
  --policy-document file://policy.json --set-as-default --profile parmana --region ap-south-1

aws iam delete-policy-version --policy-arn "arn:aws:iam::ACCOUNT_ID:policy/parmana-kms-signer-policy" \
  --version-id v1 --profile parmana --region ap-south-1   # delete the superseded version

aws login --profile parmana   # switch back to parmana-kms-operator
```

## Part 4 — Vercel → AWS OIDC role (what production actually uses)

This is the identity the **deployed application** uses. No static
credentials get stored in Vercel for this.

### 4.1 Find your Vercel OIDC issuer

Vercel project → Settings → Security → "Secure backend access with OIDC
federation". Note:

- **Issuer Mode**: Team or Global
- **Owner slug** (shown in the same panel)

In this project: Team mode, owner slug `pavan-dev-singh-charaks-projects`.

### 4.2 Create the IAM OIDC identity provider (as root/admin)

```
aws iam create-open-id-connect-provider \
  --url "https://oidc.vercel.com/YOUR_OWNER_SLUG" \
  --client-id-list "https://vercel.com/YOUR_OWNER_SLUG" \
  --profile parmana --region ap-south-1
```

No `--thumbprint-list` needed — AWS auto-verifies via trusted CAs for
providers using well-known certificate authorities.

For **Global** issuer mode instead, use `--url "https://oidc.vercel.com"`
(no owner-slug suffix) and adjust the trust policy's `Federated` ARN and
condition keys accordingly (drop the `/OWNER_SLUG` suffix throughout).

### 4.3 Create the trust policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/oidc.vercel.com/YOUR_OWNER_SLUG"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.vercel.com/YOUR_OWNER_SLUG:aud": "https://vercel.com/YOUR_OWNER_SLUG",
          "oidc.vercel.com/YOUR_OWNER_SLUG:sub": "owner:YOUR_OWNER_SLUG:project:YOUR_PROJECT_NAME:environment:production"
        }
      }
    }
  ]
}
```

**Scope the `sub` condition to `environment:production` only unless you
deliberately want preview/development deployments to also be able to
assume this role.** `project:YOUR_PROJECT_NAME` must match the exact
Vercel "Project Name" (Settings → General), not the deployment URL/domain.

### 4.4 Create the role and its runtime-only policy

```
aws iam create-role --role-name parmana-vercel-kms-signer \
  --assume-role-policy-document file://trust-policy.json \
  --description "Assumed by Parmana's Vercel deployment via OIDC to sign with the gateway KMS key" \
  --profile parmana --region ap-south-1
```

This role's permissions policy is deliberately **narrower** than the local
operator's — signing/verification only, no key management:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "UseThisSigningKeyOnly",
      "Effect": "Allow",
      "Action": ["kms:Sign", "kms:GetPublicKey", "kms:DescribeKey"],
      "Resource": "arn:aws:kms:REGION:ACCOUNT_ID:key/YOUR_KEY_ID"
    }
  ]
}
```

```
aws iam create-policy --policy-name parmana-vercel-kms-runtime-policy \
  --policy-document file://runtime-policy.json --profile parmana --region ap-south-1

aws iam attach-role-policy --role-name parmana-vercel-kms-signer \
  --policy-arn "arn:aws:iam::ACCOUNT_ID:policy/parmana-vercel-kms-runtime-policy" \
  --profile parmana --region ap-south-1
```

Note the role's ARN: `arn:aws:iam::ACCOUNT_ID:role/parmana-vercel-kms-signer`.

## Part 5 — Vercel-side configuration

### 5.1 Confirm the OIDC credentials package is installed

```
grep -r "@vercel/oidc-aws-credentials-provider" --include="package.json" .
```

Should already be a dependency of `packages/api` and `packages/crypto`
(`KmsSigner.ts` dynamically imports it only when `AWS_ROLE_ARN` is set).
If missing: `npm install @vercel/oidc-aws-credentials-provider` in both
packages.

### 5.2 Link the repo and set environment variables

```
vercel login
vercel link --yes --project YOUR_PROJECT_NAME
```

Set three env vars, scoped to **Production only** (matching the trust
policy's `environment:production` condition):

```
vercel env add AWS_ROLE_ARN production
# value: arn:aws:iam::ACCOUNT_ID:role/parmana-vercel-kms-signer

vercel env add AWS_REGION production
# value: ap-south-1 (or your region)

vercel env add KEY_PROVIDER production
# value: aws-kms
```

> If `KEY_PROVIDER` already exists (common if the project predates this
> migration), `vercel env add` fails with `branch_not_found` / "variable
> already exists" — you must `vercel env rm KEY_PROVIDER production` then
> re-add it, or edit the value directly in the dashboard. **Check what it's
> currently set to first if you're not sure it's safe to change** — see
> the troubleshooting guide for why this specific value flip caused a full
> production outage the first time it was done here.

### 5.3 Deploy and verify

```
vercel deploy --prod
```

Then, from any machine (no auth needed for this endpoint by design):

```
curl https://YOUR-PROJECT.vercel.app/keys/default
```

Expect a `200` with a real PEM-encoded Ed25519 public key and `algorithm:
"ed25519"`. A `500` here means something in Parts 1-5 isn't wired
correctly — go to the troubleshooting guide.

```
curl https://YOUR-PROJECT.vercel.app/health
```

Expect `{"status":"UP"}`.

## What you should NOT do

- Do not put `AWS_ROLE_ARN`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
  static credentials in Vercel for the deployed application's runtime
  signing. The entire point of Part 4 is to avoid that.
- Do not delete `PARMANA_KEY_MATERIAL_JSON` from Vercel/`.env` immediately
  after this guide. Keep it as a fallback until `KEY_PROVIDER=aws-kms` has
  been live and verified stable for a real period of time — ADR-0009
  explicitly calls this out as a last, separate step, not part of the
  cutover itself.
- Do not skip Part 3 (tightening the operator's policy after key creation)
  — `kms:CreateKey` with no resource constraint is broader than the
  operator needs for ongoing work.
- Do not assume `alias/default` is optional because `alias/parmana-ed25519-signer`
  (or whatever descriptive name you chose) already exists — the code
  specifically resolves the logical keyId `"default"`, not your
  descriptive alias name.
