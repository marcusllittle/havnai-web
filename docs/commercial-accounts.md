# HAVN-11 web implementation contract

The authoritative v1 ownership, identity, migration, payment and threat-model
contract is `havnai-core/docs/commercial-accounts.md` on branch
`feat/havn-11-commercial-accounts` (HAVN-18).

This branch now includes Clerk provider integration, sign-in/sign-up/account pages,
account-scoped authenticated requests and logout/account-switch isolation. Clerk
development sign-in is configured and verified. Account checkout and Music Studio
creation/recovery/publication, music library/playlist management, and account Video
Studio are implemented; live paid generation acceptance, image creation and its
library, marketplace/workflow ownership, and explicit
migration remain. Optional wallet link/unlink UI is implemented; live wallet and
provider reverification acceptance remains pending.
Keep HAVN-11 open until the complete acceptance flow has been exercised.

Configured deployments now use account authorization for saves, likes, private
music libraries, playlist creation/editing/sharing/reordering, and adding songs
from Discover or creator pages. Guests keep public browsing/playback and receive
a sign-in option for private actions, even if a wallet extension is connected.
Private views and dialogs remount on account changes; late account requests are
aborted and discarded. Playlist creation retains its account-scoped ID through
ambiguous retries, including a failure while adding the initial song. Saved-song
pagination exposes tracks beyond the first 80. The frontend does not send a
wallet address, shared owner token, or signed wallet nonce to these account APIs.

Component tests cover these operations, guest behavior, and account-switch
isolation with mocked account transport. Core tests independently exercise actual
SQLite ownership checks and signed-session validation. A mobile guest browser
check confirms the sign-in UI renders without errors. These are not evidence of
a live paid generation or production-provider acceptance run.

## Account Video Studio

Configured Video Studio uses account `/v2/capabilities`, `/v2/assets`, and `/v2/jobs`
for uploads, submission, history, polling, and cancellation. It does not read the
legacy studio key or legacy active-render cache. The active render is account
scoped and restored after refresh. Guests see sign-in instead of a studio-key gate.
An account switch unmounts the workspace and aborts its pending requests.

Before the billable POST, the original payload, uploaded asset IDs, and request
key are persisted in an account/video-scoped session intent. An ambiguous response
offers **Resume video request**, which sends the same payload/key without uploading
another image or creating a second reservation. Definitive pre-enqueue errors
allow correction. Music uses the same intent implementation with a separate key.

The authenticated media proxy now permits common raster image and video formats
as well as audio, with range support and `private, no-store`. It rejects HTML,
SVG, XHTML, and unknown active formats rather than serving them on the app origin.
Core continues to authorize each artifact against its source job owner. The UI
uses cookie-authenticated media URLs; bearer tokens never appear in those URLs.
Tests cover duplicate submission, lost-response recovery, account-switch cleanup,
private playback URLs, and legacy compatibility. They use fixture media and
mocked account transport; live video generation is still an acceptance requirement.

## Optional wallet settings

The account page requests a wallet only after **Link wallet** or an explicit
unlink confirmation. It signs the exact core-issued EIP-191 message, validates
the recovered address, and submits only the challenge ID and signature. It does
not send transactions, fund credits, import content, or alter reward destinations.
Account/wallet/network changes cancel pending authorization. A still-open wallet
signature blocks additional prompts even after cancellation in the page.

When core returns `reauthentication_required`, Clerk's `useReverification` opens
its first-factor verification UI. Privileged requests fetch a fresh signed token
after verification; core still enforces the five-minute factor age, session-bound
proof, expiry, and one-time consumption. Implementation follows the installed
Clerk SDK and [Clerk reverification documentation](https://clerk.com/docs/guides/secure/reverification).
The development application was checked via Clerk CLI: email is required and
`email_code` is enabled as a sign-in strategy. Completing the live email-code
reverification and MetaMask signature still requires a user acceptance run.

Unlinking retains account content, credits, receipts, and login. The UI asks for
the linked address's proof and refreshes durable server state after ambiguous
errors; it does not automatically retry a signature or move assets. Tests use
real EIP-191 signatures with local test keys plus mocked provider transport, and
exercise wrong-account proofs, cancellation, wallet changes, duplicate clicks,
exact-message signing, and explicit unlink confirmation.

## Required web changes in HAVN-19/21/22

* Introduce a standard account session independently of `WalletProvider`.
  The permanent HavnAI account ID comes from authenticated core `/v2/account`.
  A wallet address, environment wallet, email, or client-supplied ID is never
  an account session. No fake wallets for account users.
* Configure a managed sign-in provider in the existing Pages Router. Provider
  is Clerk; production application configuration remains pending. Keep public browse and music playback
  anonymous. Show Sign in for private account operations, not Connect Wallet.
* Forward short-lived verified-provider session tokens on account API requests.
  Never attach `HAVNAI_OWNER_TOKEN` or the shared studio key to these requests.
  The current `pages/api/owner/[...path].ts` remains an owner-only path until
  its commercial replacement is implemented and verified.
* Scope library/history/credit/playlist caches to the immutable account ID.
  Logout/account change clears them and cancels pending work. Wallet switching
  only invalidates wallet caches and pending wallet proofs.
* Generation, recovery, publication, saves, playlists, credit purchases and
  account library navigation use account authorization without MetaMask prompts.
  Keep per-object checks in core; hiding a button is not access control.
* Make Link wallet an explicit optional account-settings action. Explain that it
  unlocks blockchain capabilities and does not move existing content or credits.
  Sign the exact stored challenge message returned by core. Do not build a
  message locally or reuse old music/action nonces with placeholder amounts.
* Import existing wallet content is a separate preview and confirmation flow.
  Show selected asset counts, credit balance, conflicts/exclusions, and the
  destination account. A changed preview requires another confirmation.
* Unlink keeps account data and credits. It must not log the user out, clear the
  account library, or silently move anything to another wallet/account.
* Conventional checkout sends a package ID and stable Idempotency-Key. Prices
  and credited quantities come from core. A success redirect is not proof of
  payment; refresh durable account payment/receipt state after returning.
* Show prices, credit units, applicable terms and refund information before
  checkout. Show pending/paid/refunded/disputed receipt states honestly.
* Display core JSON error codes as actionable messages without raw HTML, tokens,
  or another user's identity. A missing payment/auth configuration is not success.

## Browser/API acceptance matrix

| Actor | Expected behavior |
| --- | --- |
| Guest without wallet extension | Browse/play public media; sign-in prompt for private actions; zero wallet requests |
| Signed-in user without wallet | Buy credits, generate, recover, publish and manage library/playlists |
| Signed-in user with linked wallet | Same account content/balance after wallet switch; optional blockchain actions only prompt on user intent |
| Legacy wallet-only user | Existing supported flow continues until explicit account import; no automatic data assignment |
| Different signed-in account | Cannot read/edit another account's private objects even if an old wallet/proxy parameter is supplied |
| Expired/suspended session | Core denies private operations; no fallback to environment wallet/shared owner token |

Verify fresh registration through paid credit funding, one successful generation,
recovery after refresh, publication and public playback. Repeat account navigation
and assert no `eth_requestAccounts` or `personal_sign` calls. Test payment retry,
failed/refunded payment, account switch, linked-wallet switch, and stale import
preview. Production-provider evidence is required separately from mocked tests.
