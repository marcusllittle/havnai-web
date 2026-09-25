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
3. Put these values in the ignored `havnai-web/.env.local` (and corresponding
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

Production rollout still requires provider lifecycle webhooks, completed studio/
publication/migration/payment integration, terms and refund policy, and the full
HAVN-11 acceptance run. A locally passing mocked-provider test is not that evidence.

Reference: [Clerk session customization](https://clerk.com/docs/guides/sessions/customize-session-tokens).

The account page now reads authenticated purchase history and durable receipts
from core's `/v2/account/purchases` routes. Refund/dispute adjustments are shown
from the stored receipt history. Account changes unmount the old receipt view
and abort its requests. A checkout return URL never marks a purchase paid.
Account pricing/checkout controls and published commercial policies remain to be
integrated; the existing `/pricing` page still uses the legacy wallet flow.
