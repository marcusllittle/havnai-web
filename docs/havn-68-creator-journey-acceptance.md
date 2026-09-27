# HAVN-68 Creator Journey Acceptance

Date: 2026-09-27
Branch: `codex/havn-68-creator-journey`
Base: `origin/feat/havn-11-commercial-accounts` at `dc2285e`

## Purpose

HAVN-68 is an acceptance gate for the account-first commercial creator journey. This branch adds repeatable public-route evidence and records the remaining manual/credentialed gates. It does not claim that the full signed-in/funded journey is complete.

## Public Device Matrix Audit

Script: `scripts/creator_journey_public_audit.mjs`

The script checks the release candidate or production URL with three user-agent profiles:

- desktop Chrome
- iPhone Safari
- Android Chrome

Routes checked:

- `/`
- `/discover`
- `/create`
- `/music`
- `/video-studio`
- `/pricing`
- `/library`
- `/music/library`
- `/support`

Coverage:

- Public pages return HTTP 2xx for each device profile.
- Public music/discover and studio entry routes do not claim MetaMask or invite-code access is required.
- Create/music/video entry routes expose launch-access copy.
- Pricing and library routes surface account/sign-in/credit language rather than wallet-only blockers.
- Basic rendered HTML check for accessible names on buttons/links.

## Evidence Collected On 2026-09-27

- `npx tsc --noEmit`: passed.
- `npm run build`: passed; production build rendered the audited routes.
- `npm test`: first full-suite run failed 6 tests in `operatorWorkers`, `receiptAnchors`, and `testerOnboarding`. The failures showed previous-test fetch calls/timeouts consistent with shared global mock bleed, not this docs/script change.
- Targeted rerun passed: `npx vitest run lib/__tests__/operatorWorkers.test.ts lib/__tests__/receiptAnchors.test.ts lib/__tests__/testerOnboarding.test.ts` passed 15/15.
- Local rendered audit passed against `http://localhost:3028`: 3 device profiles x 9 routes, all HTTP 2xx with required public-route anchors.
- Production rendered audit against `https://joinhavn.io` failed on `/create`, `/music`, `/video-studio`, `/pricing`, and `/library` for all three device profiles. `/`, `/discover`, `/music/library`, and `/support` passed. This indicates production is still behind the current release branch for these launch-access/account-first public route surfaces.

Run:

```bash
node scripts/creator_journey_public_audit.mjs http://localhost:3000
HAVNAI_WEB_BASE_URL=https://joinhavn.io node scripts/creator_journey_public_audit.mjs
```

## Remaining Acceptance Gates

HAVN-68 should stay open until these are proven against the release candidate:

- Browser/device evidence from real desktop Chrome, iPhone Safari, and Android Chrome, not user-agent HTTP probes only.
- Fresh user signs in through Clerk without MetaMask.
- Fresh user funds credits through the current production payment path; reuse HAVN-25 automatic Stripe funding and replay evidence for webhook/idempotency.
- Signed-in account can see generation prices and generate image, music, and video in the production UI without MetaMask.
- Refresh/return preserves accepted jobs, history, ownership, and credit reservation/capture/release state.
- Preview/playback/download, later-session library access, publish/unpublish, Discover, creator attribution, likes, and playlists work for supported content.
- Failure/recovery cases are exercised: failed uploads, unsupported uploads, insufficient credits, offline/retry, missing artifacts, failed generation, no duplicate job, and no duplicate charge.
- Keyboard navigation, focus order, labels, contrast, and media controls are reviewed on primary flows; mobile has no blocking overflow or unreachable controls.

## Reuse

- HAVN-25: Stripe automatic funding and idempotent replay evidence.
- HAVN-12: worker stability and mixed-model generation readiness.
- HAVN-14: public/private content isolation.
- HAVN-15/HAVN-16: artifact lifecycle and marketplace behavior where applicable.
- HAVN-69: public/protected route security checks.
- HAVN-70: trust/support/privacy/policy surfaces.
