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

The panel reads the authenticated import capability endpoint and fails closed
if it is unavailable or disabled. With execution enabled, **Confirm import with
wallet** checks for an existing receipt before opening a wallet. The confirmation
explains that unlinking will not reverse the transfer and blockchain tokens do
not move. The backend rollout switch remains off by default pending migration
and launch verification.

After signing, the panel retains the exact proof in memory for **Retry import**.
**Check import result** only reads the receipt and never requests a signature.
Selection changes are locked while a signed outcome is unresolved. Closing the
panel discards the in-memory proof; users can still check durable import history.
A confirmed receipt shows completion and refreshes account balances. Tests cover
passive browsing, explicit selection, pagination, exact retries, duplicate-click
suppression, recovery without wallet access and aborts during signing.

The account page also offers **Import receipts** independently of linked-wallet
state. History loads on demand with ten entries per page. Completed records show
resource counts and exact credit units; opening a receipt shows the transferred
creation, publication and playlist IDs. Pending snapshots never appear as
completed imports. Reads require only account authentication, and no wallet
provider is used. Closing history or switching accounts cancels pending reads.
Errors remain distinct from empty history and can be refreshed explicitly.

`lib/accountImport.ts` provides the panel's confirmation transport.
It validates account/session/link/snapshot/digest/origin/network, exact resource
IDs, integer credit units and expiry against the reviewed snapshot before
signing. It shares a pending-signature lock with wallet link/unlink operations,
pins the address/network across signing, and aborts on provider changes.
Execution first checks for a durable receipt, then sends only the stored proof;
a lost response triggers receipt recovery rather than another wallet request.
Signed proofs stay in memory, never browser storage.

Workflow templates are now an explicit selection alongside creations, music
publications and playlists. Workflow-only reviews are allowed; paging uses the
workflow inventory count as well as the other counts. The review displays each
selected workflow's name and existing public/private status. Import preserves
that status. Workflow IDs must match the signed challenge and recovered receipt
exactly, including when the reviewed list is empty. Older snapshots and receipts
without workflow fields remain compatible as empty selections. History summaries
and receipt details include completed workflow transfers. This requires the core
version-4 snapshot implementation; the production import switch remains off.
