# HAVN-70 Trust And Account Privacy Closeout

Date: 2026-09-27
Branch: `codex/havn-70-trust-privacy`
Base: `origin/feat/havn-11-commercial-accounts` at `dc2285e0cabbf91c4706fdf5769e67e75de2488d`

## Public Trust Surfaces

- `/terms` covers platform use, account identity, optional wallets, credit-policy linkage, creations and ownership, public content, support, and availability limits.
- `/privacy` covers account, creation, payment, wallet, node, support, public-content, retention, provider-sharing, and request handling.
- `/terms/credits-v1` remains the checkout-specific credit purchase policy.
- `/refunds/credits-v1` remains the checkout-specific refund policy.
- `/ownership` remains the product guide for generation history, account-owned assets, wallet-owned assets, and Astra compatibility.
- `/support` remains the reporting path for billing, account, creation, wallet, node, content, ownership, and privacy issues.

## Wiring

- Shared commercial footer now links platform terms, privacy, ownership, credit terms, refunds, account receipts, pricing, and support.
- Sitemap includes `/terms`, `/privacy`, `/ownership`, `/terms/credits-v1`, `/refunds/credits-v1`, and `/support`.
- SEO social-image mapping includes `/terms` and `/privacy`.

## Verification

Run locally or against production:

```bash
node scripts/trust_surface_audit.mjs http://localhost:3000
HAVNAI_WEB_BASE_URL=https://joinhavn.io node scripts/trust_surface_audit.mjs
```

Expected result: all trust routes return HTTP 2xx and contain their required content anchors.

## Limits

This is a product consistency and launch-readiness pass. It does not claim outside legal review. Production acceptance still requires deploying the merged web branch and running the audit against `https://joinhavn.io`.
