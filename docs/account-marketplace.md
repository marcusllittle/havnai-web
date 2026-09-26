# Account marketplace

When Clerk is configured, the marketplace gallery uses the account API. Guests
browse `/v2/marketplace/listings` without authorization or wallet requests. Public
images use only the dedicated reduced-preview endpoint. The existing workflow
catalog remains available through the Workflows link; its ownership migration is
separate work.

Signed-in users can purchase with integer account credits, view their current
listings/purchases, delist, download owned originals through `/api/account-media`,
and read sale/purchase receipts. Account changes remount the workspace and abort
its requests. Account-owned response rows are checked against the active account
before display. The page does not call MetaMask or wallet purchase APIs.

Purchase/listing intents are stored in account-scoped session storage before any
POST. A lost response retains the same idempotency key, listing and integer price.
Recovery requires an explicit click and never submits automatically on navigation.
Definitive pre-settlement rejections clear the intent; ambiguous failures and
unconfirmed receipts retain it. Storage failure prevents submission. Prices retain
all three decimal places supported by the ledger. Successful DELETE responses can
return HTTP 204 without a JSON body.

Completed image generations in Collection and the result drawer now link to the
account listing form. The form loads the authoritative owned job, offers a preview
image choice for multiple outputs, and requires a public title and exact credit
price. It never copies the private generation prompt into the public title. It
explains public-preview visibility and transfer of the creation's outputs before
publishing. The server enforces final ownership and settlement eligibility.
Purchased or delisted creations can be relisted from the account marketplace.
Pending listing requests survive navigation and retry their original details.
Collection recognizes the account API's `succeeded` status as Ready.

Validation: marketplace transport/component tests cover guest access, duplicate
clicks, lost-response retries, account changes, private media, delisting, receipts,
and malformed stored requests. Mobile guest browsing and the sign-in gate were
checked at localhost:3100 against the isolated coordinator preview. Real signed-in
purchases with the user's Clerk session still need acceptance testing.
