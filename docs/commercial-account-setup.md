# Clerk setup for HAVN-11

Clerk is new; the operator confirmed an existing Stripe account. Do not create a
replacement Stripe account or move existing payment credentials.

## Development application

1. Create a HavnAI application in [Clerk Dashboard](https://dashboard.clerk.com/).
   Enable email sign-in with verified email addresses. Use a development instance
   while validating the branch; add social providers only if desired.
2. In Sessions, add `{"aud":"havnai-api"}` under Customize session token. Keep
   the provider's default subject, session, expiry and factor-verification claims.
   Core accepts short-lived session tokens, not custom machine tokens or wallet
   signatures as account authentication.
3. Use the authenticated Clerk CLI to pull development keys into a temporary
   environment file (`clerk env pull --app <application-id> --instance dev
   --file <temporary-file>`). Merge only the two Clerk entries below into the
   existing ignored `.env.local`, preserving every other setting, then delete
   the temporary file. Do not run scaffolding commands on this existing app.
   The values belong in `havnai-web/.env.local` (and the corresponding
   deployment environment when ready), never in a commit or chat message:

   ```dotenv
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
   CLERK_SECRET_KEY=<Clerk secret key>
   ```

4. Configure core's private service environment:

   ```dotenv
   CLERK_SECRET_KEY=<same Clerk application's secret key>
   HAVNAI_CLERK_ISSUER=https://<your-instance>.clerk.accounts.dev
   HAVNAI_CLERK_AUDIENCE=havnai-api
   HAVNAI_ACCOUNT_ORIGINS=http://localhost:3100
   ```

   Use the exact Frontend API/issuer URL shown for the application. Production
   uses its production issuer and explicit HTTPS application origins. Multiple
   origins are comma-separated; do not allow `*`. Alternatively core can verify
   with `CLERK_JWT_KEY` containing the application's PEM public key, with a key
   rotation runbook. Do not put a secret key in a `NEXT_PUBLIC_` variable.
5. Install core's updated `server/requirements.txt` in the coordinator environment
   before restarting it. Restart the local web dev server after setting variables;
   `NEXT_PUBLIC_` variables require a rebuild for deployment.
6. Open `/sign-up`, register, then `/account`. Verify an empty wallet list and zero
   starting credits. Refresh, sign out, and sign in again; the immutable account ID
   must remain the same. A second user must receive a distinct account and balance.

Production rollout still requires live provider lifecycle webhook delivery, completed studio/
publication/migration/payment integration, terms and refund policy, and the full
HAVN-11 acceptance run. A locally passing mocked-provider test is not that evidence.

Reference: [Clerk session customization](https://clerk.com/docs/guides/sessions/customize-session-tokens).

The account page now reads authenticated purchase history and durable receipts
from core's `/v2/account/purchases` routes. Refund/dispute adjustments are shown
from the stored receipt history. Account changes unmount the old receipt view
and abort its requests. A checkout return URL never marks a purchase paid.
When Clerk is configured, `/pricing` uses the public account catalog and
authenticated account checkout. It requires published terms/refund links and
explicit agreement before purchase. A durable per-account checkout attempt in
session storage preserves the idempotency key after a lost response. Catalog
versions prevent stale prices from creating a new purchase. Without Clerk
configuration, the legacy wallet pricing route remains available.

## Isolated local account preview

From the core feature worktree, using its installed Python environment:

```bash
python -B scripts/account_preview.py --web-env /path/to/havnai-web/.env.local
```

This reads development keys without printing or copying them, derives the
Clerk issuer, and runs a loopback API on port 5101. A dedicated marked storage
directory keeps its database and assets separate from the coordinator. Payments,
HAI funding, and node enrollment credentials are disabled or isolated. Override
`--data-dir` only with an empty directory or an existing marked preview directory.

In a separate PowerShell terminal in `havnai-web`:

```powershell
$env:HAVNAI_API_BASE_URL = 'http://127.0.0.1:5101'
npm run dev -- -p 3100
```

This overrides the API for that process without replacing the saved coordinator
URL. Visit `http://localhost:3100/sign-up` and complete email/social verification.
The website account is separate from the Clerk dashboard operator login.
Checkout is deliberately unavailable in this preview; it cannot charge a card.

## Commercial policy release

Public credit terms, refund and support routes are implemented on this branch;
see [HAVN-32 release evidence](credit-policy-release.md) for browser/build checks,
the proposed wording, exact required coordinator policy URLs, and the outstanding
owner approval/deployment/configuration gates. Local sandbox purchases keep their
original development-policy URLs. Public footer links do not enable checkout or
replace the policy revision quoted by the coordinator.
