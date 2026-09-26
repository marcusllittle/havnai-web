# HAVN-32: account credit policies and support

## Implemented on the HAVN-11 feature branch

The public routes `/terms/credits-v1`, `/refunds/credits-v1`, and `/support` now
render without account authentication. They use the existing SiteHeader/SeoHead,
blue product-page styling, responsive in-page navigation, and shared commercial
footer. Pricing and account footers expose all three routes; Your Havn includes
Support; purchase details have a support link. The public sitemap includes the
three routes. The homepage body and artwork were not edited.

Terms describe one-time account-owned packs, optional wallets, supported credit
uses, no guaranteed cash value, reserve/capture/release, server-selected quotes,
versioned acceptance, receipts, Public Alpha limitations, and support. Refund
copy distinguishes full/partial refunds, active and won/lost disputes, spent-credit
debt, generation reservation releases, and immutable financial records. The
support route uses the existing published contact `team@joinhavn.io` and asks for
purchase/job references and redacted diagnostics rather than secrets.

The proposed business wording is manual, individual review of refund requests,
considering payment, usage, issue and consumer rights. It does not promise a fixed
refund window, response deadline or approval of every request. The owner reviewed
the pages in this thread and approved the wording,
then confirmed `team@joinhavn.io` is the correct contact. The copy is approved for
the release; its presence in the branch is not production deployment. Actual
support-message delivery and response handling have not been tested here.

## Preserved payment boundaries

`lib/creditPolicies.ts` names the public documents only. Checkout still takes its
policy version and URLs from the coordinator's catalog. Public footer links never
fill missing/unsafe catalog fields and never enable checkout on their own. The
explicit agreement checkbox remains required. Receipt details display the exact
policy links stored with that purchase; older receipts without links are not
retroactively assigned this revision.

## Executed verification, 2026-09-25 local time

- `npx vitest run components/__tests__/AccountPricing.test.tsx components/__tests__/AccountPurchases.test.tsx components/__tests__/SiteHeader.test.tsx lib/__tests__/accountCheckout.test.ts`: **28 passed**.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed, including all three new public routes (33 static pages).
- Signed-out browser: terms page at 1440px, footer navigation to refunds, refunds
  at 390px, its support link to `/support#payment-help`, and support at 320px.
  No page errors were reported. Refund/support document widths matched their
  viewport widths with no sideways overflow.
- The actual local pricing page displayed the sandbox agreement links and the
  new public footer links, with purchase buttons disabled for the signed-out
  browser. The served sitemap contained all three public document URLs.
- Screenshots were inspected at local paths
  `%LOCALAPPDATA%/Temp/havn11-credit-terms-desktop.png`,
  `%LOCALAPPDATA%/Temp/havn11-refund-policy-mobile.png`, and
  `%LOCALAPPDATA%/Temp/havn11-support-small-mobile.png`.
  These are local review artifacts, not uploaded Jira attachments.

The new regression cases check that visible footer policies cannot repair a
missing, script, or credential-bearing catalog URL. Receipt cases check that
stored older links survive and missing historical links are not invented. These
are UI/contract checks; they do not prove a new real payment under credits-v1.

## Observed configuration and remaining release evidence

A read of the running local catalog during this verification pass showed:

```text
checkout_available=true
terms_version=sandbox-2026-09-25
terms_url=http://localhost:3100/testing/credit-policy
refund_url=http://localhost:3100/testing/credit-policy
```

These public fields are not secrets. The existing sandbox acceptance still uses
its explicit development-only policy. No private environment or coordinator
configuration was changed for this page work. Older purchases and receipts remain
bound to their original accepted policy.

Normal HTTPS GETs to all three `https://joinhavn.io` routes returned **404** during
this pass. They are not yet published on the production site. Do not treat a successful
local build or these source files as evidence of public deployment.

After owner approval and the web release, verify the published pages, then use
these exact non-secret settings in the intended coordinator environment:

```dotenv
HAVNAI_CREDIT_TERMS_VERSION=credits-v1
HAVNAI_CREDIT_TERMS_URL=https://joinhavn.io/terms/credits-v1
HAVNAI_CREDIT_REFUND_URL=https://joinhavn.io/refunds/credits-v1
```

This is the required configuration, **not an assertion that it is active**.
Capture only those allowlisted public fields from the running catalog, confirm
pricing's agreement links, and verify a newly completed purchase's stored receipt
URLs. Keep production checkout disabled until its wider HAVN-11 payment/auth/live
acceptance gates are met. Never rewrite old receipts to the new URLs.

Public deployment, running staging/production configuration,
live receipt evidence under this revision, and attaching/linking the evidence in
HAVN-21/HAVN-23/HAVN-25 remain open. No Jira status or comment was changed.

Reference checks used the implementation in `server/account_payments.py` and
`server/account_ledger.py`, and Stripe's official [refund documentation](https://docs.stripe.com/refunds)
and [dispute lifecycle](https://docs.stripe.com/disputes/how-disputes-work).
These references establish provider mechanics, not approval of HavnAI's business
policy or compliance in every jurisdiction.
