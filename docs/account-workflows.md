# Account workflow templates

Templates uses the standard account session for private creation and management.
Guests can explore `/v2/workflows`, which includes explicitly published legacy
and account templates. Search, category and pagination run on the server. New
templates are private until the owner chooses Publish template. Publishing shares
the full prompt and settings; unpublishing removes public access.

The account library supports editing, publishing, unpublishing and confirmed
deletion. Editing preserves settings outside the fields exposed by the form.
Creation keeps an idempotency key with the exact payload for retries. A lost
response leaves the draft intact and offers a library refresh to inspect durable
state. Starting a new template creates a new intent. Account changes remount the
editor/library, clear private drafts and abort pending requests.

Create links distinguish `account:<id>` private records from `public:<id>` public
records and older unprefixed legacy links. Loading a template never generates a
job or applies settings automatically. Apply template remains explicit. Account
switches clear loaded private templates immediately.

Tests cover passive account reads, explicit publication and delete confirmation,
lost-response creation retry, account-switch isolation, private template loading,
explicit application and guest sign-in. Real signed-in browser acceptance and
legacy workflow migration remain rollout work.

Local browser check, 2026-09-25: web `c03147d` against the isolated preview
coordinator at core `85335cc` returned HTTP 200 with an empty catalog and
`private, no-store` through `localhost:3100/api/v2/workflows`. Guest Explore and
Your draft loaded without browser errors. At a 390 by 844 viewport, the document
width was exactly 390 pixels; the draft offered Sign in and stated that no wallet
is required. Visual inspection found unstyled new action buttons, now using the
existing secondary-button style. The automation browser was signed out, so this
check does not establish signed-in CRUD or production acceptance. Only the
isolated preview coordinator was restarted; imports and payments stayed disabled.
