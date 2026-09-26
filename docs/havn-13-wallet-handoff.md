# HAVN-13 wallet UX handoff from HAVN-11

This is a repository handoff, not a claim that HAVN-13 is implemented or accepted.
HAVN-11 makes the standard account the commercial identity. Wallet UX work must
preserve that boundary; it must not delay or gate normal account operations.

## Identity and prompt boundaries

| Action | Identity / authorization |
| --- | --- |
| Browse public creations or play published music | Guest; no wallet prompt |
| Buy credits, generate, recover, publish, manage library/playlists/workflows | Standard account; no wallet signature |
| View account payment receipts | Standard account; no wallet signature |
| Link or unlink a wallet | Explicit user action, recent account verification, exact expiring core-issued wallet proof |
| Review legacy wallet content | Account plus existing active link; review itself does not sign or transfer |
| Import selected legacy content/credits | Separate explicit confirmation and fresh proof binding the exact selection; rollout gate applies |
| Token conversion, reward claims, on-chain ownership transfer or receipt anchoring | Explicit wallet action with its own authorization and network requirements |

An account payment receipt is not an on-chain artifact receipt. A linked wallet
does not automatically change a reward destination, move a balance, or assign
legacy content to the account. Unlink never deletes account data or logs out the
standard account. Switching the extension's address must not switch account
history, credit balance, private media, or pending commercial requests.

## Implementation entry points

- `components/AccountProvider.tsx`: standard session and authenticated transport.
- `components/AccountWallets.tsx`: voluntary link/unlink, capability explanation,
  recent account verification, and entry to legacy-content review.
- `lib/accountWalletProof.ts`: exact-message proof validation and shared pending
  signature lock. Reuse its semantics rather than constructing messages in UI.
- `components/AccountImportReview.tsx` and `lib/accountImport.ts`: immutable
  selection, explicit signing, and lost-response recovery. A retry checks durable
  state and reuses the existing proof; it must not automatically prompt again.
- `components/WalletProvider.tsx` and `lib/wallet.ts`: extension selection and
  wallet lifecycle. These remain independent of the commercial account identity.

Account and wallet/network changes cancel pending authorization. Cancellation in
the app cannot close an extension popup; an unresolved signature must retain its
lock until the provider request settles. Recovery messages must distinguish
reconnecting an extension, reverifying the account, and retrying a server request.
Never tell users to reconnect MetaMask for an account API or payment failure.

## Verification to carry into HAVN-13

1. Navigate Create, Music, Library, Collection, Templates and account receipts
   with no wallet extension. Repeat with a connected extension and assert zero
   `eth_requestAccounts` / `personal_sign` calls during normal navigation.
2. Explicitly link a wallet, cancel a signature, double-click, switch address or
   chain while pending, and recover a lost server response. No prompt storm,
   wrong-account attachment, replay, or silent ownership transfer is acceptable.
3. Link a second wallet; unlink one. Account content, credits, receipts and login
   remain unchanged. Verify the UI against durable state after ambiguous errors.
4. Confirm network-specific claims/anchoring errors stay within those optional
   actions. An unavailable reward contract cannot block standard account use.
5. Repeat at a narrow mobile viewport with the target wallet's actual browser or
   extension. Automated provider mocks do not prove extension/mobile behavior.

Existing regression entry points are `AccountWallets.test.tsx`,
`AccountProvider.test.tsx`, `WalletLifecycle.test.tsx`,
`WalletConnectIntegration.test.tsx`, `accountWalletProof.test.ts`, and
`accountImport.test.ts`. They cover components and provider simulations; actual
wallet acceptance remains open. See [the account contract](commercial-accounts.md)
and [import review](account-import-review.md) for rollout limits. Do not enable
imports or change production services as part of this handoff alone.
