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
