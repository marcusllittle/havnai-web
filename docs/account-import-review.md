# Existing wallet content review

The account page's linked wallets now offer **Review wallet content**. Opening
the panel uses authenticated account requests to core's import-preview endpoint;
it does not connect a wallet or request a signature.

The panel paginates creations and playlists, shows publication dependencies and
ineligible records, and keeps explicit selections across pages. Credits are
opt-in. **Review selection** prepares an expiring core snapshot through the
existing recent-account-verification adapter. It displays the selected resources
and exact credit amount. A lost response can be retried with the same key and
body; editing is locked until the retry succeeds or the user starts over.

The panel is scoped to the signed-in account and linked-wallet ID. Closing it,
unlinking that wallet, or switching accounts unmounts it and aborts pending work.
Review state is not shared between accounts or persisted in browser storage.

This is a review interface, not an enabled transfer flow. It explicitly states
that no content or credits have moved. Signature confirmation, execution recovery
and rollout verification still need UI integration.
The core signed execution implementation remains internal pending the remaining
migration and launch requirements. Tests cover passive browsing, explicit
selection, pagination, exact retry, duplicate-click suppression and aborts.

The account page also offers **Import receipts** independently of linked-wallet
state. History loads on demand with ten entries per page. Completed records show
resource counts and exact credit units; opening a receipt shows the transferred
creation, publication and playlist IDs. Pending snapshots never appear as
completed imports. Reads require only account authentication, and no wallet
provider is used. Closing history or switching accounts cancels pending reads.
Errors remain distinct from empty history and can be refreshed explicitly.

`lib/accountImport.ts` provides the confirmation transport for the next UI step.
It validates account/session/link/snapshot/digest/origin/network, exact resource
IDs, integer credit units and expiry against the reviewed snapshot before
signing. It shares a pending-signature lock with wallet link/unlink operations,
pins the address/network across signing, and aborts on provider changes.
Execution first checks for a durable receipt, then sends only the stored proof;
a lost response triggers receipt recovery rather than another wallet request.
Signed proofs are intended to stay in memory, never browser storage. The review
panel does not invoke this transport yet.
