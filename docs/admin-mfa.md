# Admin MFA

The single-admin login requires the admin password and a Google Authenticator
TOTP code, or a single-use recovery code. MFA cannot be disabled by omitting
configuration: the admin API fails closed. Existing password-only sessions do
not work with the new signing key.

## Enroll

Run `npm run setup:admin-mfa`. It creates two private, gitignored files with
owner-only permissions:

- `.env.admin-mfa-setup.html`: offline QR code, manual key, and ten recovery codes.
- `.env.admin-mfa.local`: the three server environment variables.

Open the private setup page locally and scan its QR code in Google Authenticator.
Use the six-digit code alongside your current admin password. Keep the recovery
codes in a password manager. The QR is generated locally; enrollment does not
send secrets to Google. Do not publish the setup page or configuration file.

The local Express server loads `.env.admin-mfa.local` automatically. Explicit
environment variables take precedence. The Vite dev server blocks `.env*`
files; the production build does not copy the setup page.

## Vercel

Before deploying, add these variables from the private configuration file as
sensitive server variables in the intended Vercel environment:

- `ADMIN_TOTP_SECRET`
- `ADMIN_SESSION_SECRET`
- `ADMIN_RECOVERY_CODE_HASHES` (JSON array; omit the surrounding shell quotes)

Keep `ADMIN_PASSWORD` configured. No variable uses a `VITE_` prefix. Verify the
authenticator entry and securely store the recovery codes before activating
the new deployment, since an unconfigured deployment refuses admin access.

Hosted MFA uses the existing `GITHUB_TOKEN` (or `ROWK_GITHUB_TOKEN`) and repository
settings. The token needs repository Contents read/write access. It creates the
`rowk-admin-auth` branch from `GITHUB_BRANCH` (default `main`) if necessary. The
branch holds AES-256-GCM-encrypted security state. `vercel.json` disables its
automatic deployments, and state commits also include `[skip ci]`.

All instances share atomic compare-and-swap updates guarded by GitHub's file
SHA. There is no in-memory fallback if GitHub is unavailable. A code is consumed
before a session is issued. State files are scoped to the MFA configuration,
so separately configured preview and production environments do not overwrite
each other's counters. Local development uses encrypted files with file locks
under the gitignored `.admin-security/` directory.

Allow up to ten login attempts per account in ten minutes, in addition to the
existing IP limiter. Successful attempts count toward this budget; retries
after a rejected/reused code may require waiting for the next 30-second code.
GitHub storage is suitable for this small admin portal, with added API latency
and dependency on GitHub availability and quotas. It is not intended for a
public multi-user authentication service.

## Recovery And Rotation

A recovery code still requires the admin password and is consumed atomically.
It signs in without disabling MFA. A stolen session expires after twelve hours.
Changing the password, authenticator secret, or session secret invalidates all
previous sessions.

If the phone and recovery codes are both lost, use the authorized Vercel owner
account to provision a new setup and deploy the new secrets. Protect that owner
account with MFA too. Retain the old files securely during recovery, generate a
fresh setup in a separate private directory, enroll it, and replace all three
server variables together. Never reset replay counters under unchanged MFA
credentials or restore old security-state files.

## Verification

`npm run test:admin-auth` checks password-and-code enforcement, clock windows,
replay rejection, atomic recovery consumption, shared rate limits, encrypted
storage, concurrent GitHub conflicts, session invalidation, and API access.
Existing SSRF tests remain available as `npm run test:security` and
`npm run test:security:browser`.
