# HAVN-69 Web Dependency Audit

Date: 2026-09-27

Branch: `codex/havn-69-web-security-audit`

Base: `feat/havn-11-commercial-accounts`

## Scope

This audit covers `havnai-web` package dependencies for the commercial launch
security gate. It complements the core HAVN-69 evidence packet in
`havnai-core/docs/havn-69-security-acceptance.md`.

## Commands

```bash
npm audit --json
npm audit --omit=dev --json
npm update nanoid vitest @vitest/mocker --package-lock-only
npm ci
npm audit --json
npm audit --omit=dev --json
npx tsc --noEmit
npm test
```

## Results

Initial audit:

- `npm audit --json`: 8 total advisories, 1 high and 7 moderate.
- `npm audit --omit=dev --json`: 6 production advisories, 1 high and 5 moderate.
- High advisory: `nanoid <3.3.18` via PostCSS.
- Dev-only moderate advisory: `vitest` / `@vitest/mocker <4.1.11`.

Fix applied:

- Lockfile-only update of `nanoid`, `vitest`, and `@vitest/mocker`.

Post-fix audit:

- `npm audit --json`: 5 moderate, 0 high, 0 critical.
- `npm audit --omit=dev --json`: 5 moderate, 0 high, 0 critical.
- The high `nanoid` advisory and Vitest advisory are cleared.

Remaining moderate advisories:

- `uuid <11.1.1`, pulled through `@metamask/sdk`,
  `@metamask/sdk-communication-layer`, and `@metamask/utils`.
- `@metamask/sdk@0.34.0` is the latest published version observed during this
  audit and is deprecated in favor of the newer MetaMask Connect guidance.
- `npm audit` reports no automatic direct fix for the remaining direct
  `@metamask/sdk` chain.

Release interpretation:

- No critical or high dependency advisories remain after the lockfile update.
- The remaining moderate finding is isolated to optional wallet/MetaMask
  integration, which is not required for account-first sign-in, checkout, or
  generation.
- Track migration away from deprecated `@metamask/sdk` under the wallet UX lane
  before claiming the optional wallet stack is fully clean.

## Verification

- `npx tsc --noEmit` passed.
- First full `npm test` run showed an intermittent `testerOnboarding` failure;
  the file passed in isolation immediately afterward.
- Full suite rerun passed: `80 passed`, `484 tests passed`, duration `126.67s`.
