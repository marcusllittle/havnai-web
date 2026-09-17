# HavnAI visual improvement log

## Direction

Build a creative product that feels considered on a phone: readable typography,
clear actions, artwork with purpose, and controls that appear when needed.
Keep HavnAI's atmospheric identity, with quieter surfaces and fewer competing
cyan accents. Treat the create workspace differently from a marketing landing page.

## September 17, 2026 — Create workspace

### Findings

- At 390 × 844, the original first screen contained a model-count panel and a
  marketing hero. The prompt was below the viewport.
- A late block of global `!important` CSS forced a `1fr 380px` grid on phones,
  overrode responsive rules, and reordered controls away from their DOM order.
- Advanced settings were expanded by default. Account and invite information
  appeared before the prompt.
- The prompt's visible label referenced an ID missing from the textarea.
- The global navigation stayed in desktop mode until 720px despite having
  eleven destinations and a wallet action.

### Implemented

- Compact heading, mint accent, readable system typography, and a focused composer.
- Image, video, and face-swap mode buttons with icons and announced selected state.
- Settings and account details expand on demand. Generation, uploads, refinement,
  history, wallet handling, and API contracts retain their existing behavior.
- Three inspiration cards use existing Astra artwork and populate the editable
  prompt without submitting a job. Artwork is explicitly credited as Astra art.
- Optimized responsive images, reserved image dimensions, visible keyboard focus,
  reduced-motion support, and mobile inputs at 16px.
- Removed the obsolete generator layout overrides. The new CSS is page-scoped.
- Shared navigation switches to a menu at 1200px, and announces expanded state.
- Shortcut text is stable between server and browser rendering on Apple devices.

### References

- [Runway: navigating the workspace](https://help.runwayml.com/hc/en-us/articles/24298206897043-Navigating-Runway):
  focused tool controls and a distinct generation/results area.
- [Luma: web quick start](https://lumalabs.ai/learning-hub/web-quick-start):
  start with an idea, then organize and refine the resulting work.
- [Luma public product page](https://lumalabs.ai/app): visually reviewed for
  restrained typography, clear hierarchy, and art-led use-case cards.
- [Leonardo image generation](https://www.leonardo.ai/ai-image-generator):
  reference for the broader image creation product category.

These inform the direction; HavnAI uses its own assets and implementation.

### Next passes

1. Photography and product examples added in pass two; add an illustration example
   when expanding the starter set further.
2. Required video reference inputs are now visible. Continue organizing the
   remaining video settings into essential inputs and deeper controls.
3. Loading, unavailable-capacity, retry, and selected-model states are implemented.
   Add a reliable credit estimate near Generate when the coordinator is reachable.
4. Review collection, discovery, and the homepage against the new visual direction.
5. Reduce the remaining broad global CSS overrides, including hidden page containers,
   after checking the affected routes individually.
6. Verify real generation, returned media, downloads, and refinement against a
   reachable coordinator, then collect feedback on an actual phone.

## Validation scope

Completed checks:

- Development browser screenshots at 390 × 844 and 1440 × 1000.
- Inspiration click fills the prompt; generation becomes enabled; mode switching
  and image/video settings retain their values; mobile menu expands correctly.
- Automated axe scan of the create workspace: zero detected violations, with
  contrast over gradients/artwork requiring manual review.
- `npm test`: 24 files, 132 tests passed with lockfile dependencies restored.
- `npm run build -- --webpack`: passed on Next.js 16.2.12, including TypeScript
  and all 26 static pages. Existing MetaMask optional native-storage import warning.
- `git diff --check`: passed.

Browser checks cover responsive layout, mode switching, settings, prompt presets,
mobile navigation, and accessibility. The coordinator timed out from this machine;
empty API responses were mocked for isolated UI checks. These checks do not prove
live GPU generation or wallet transactions. No core changes or deployment are
part of this first pass.

Automatic approval review rejected starting the production preview server,
including a localhost-only attempt, with no specific reason beyond "blocked by
policy". Production runtime verification remains outstanding. Development browser
sessions were closed; no preview server was left running.

## September 17, 2026 — Second create pass

### Changes and evidence

- Added two original AI-generated assets: coastal editorial photography and an
  amber product still life. The third card retains an Astra environment. Both new
  assets total 482,840 bytes in WebP; responsive image sizes match the card layout.
  [Asset provenance and full prompts](../public/create/README.md).
- Loading, connection failure, and no-online-capacity are distinct visible states.
  Model requests time out after 12 seconds and cancel on unmount/retry. Generate
  stays disabled until a valid model is available; the selected model is shown.
- A catalog refresh no longer resets the draft's references and settings.
- Image-to-video workflows show their required start-frame fields even with
  advanced settings collapsed. Expanding settings does not duplicate those fields.
- Validation messages no longer replace the inspiration gallery with an empty
  output frame before a job exists.
- A responsive sweep found a 31px header overflow at 1201px. Moving the navigation
  menu breakpoint to 1280px fixes it. Verified document width matches viewport at
  320, 390, 768, 1024, 1201, 1280, 1281, and 1440px. At 390 × 844 with a ready model,
  the prompt starts at 367px and Generate ends at 684px.
- Four page-level regression tests exercise failed-load recovery and retained
  drafts, unavailable/malformed catalogs, required video inputs, and timeout.
- Full suite: 25 files / 136 tests passed. TypeScript, production webpack build,
  and diff whitespace check passed. Existing MetaMask build warning remains.
- Development-browser axe scan: no detected violations; image/gradient contrast
  requires manual review. Browser runtime error list was empty after this pass.

### Runtime limits

The localhost-only **development** preview started successfully for this pass at
`http://127.0.0.1:3100/create`. The real model endpoint still timed out. Failure-state
screenshots use that real failure; ready-state layout and Retry recovery use a
mocked catalog containing `Studio-SDXL`. No live GPU job or wallet transaction was
submitted. The earlier production-preview approval rejection is not evidence of
a development-preview failure. Changes remain local and undeployed.

## September 17, 2026 — Collection pass

- Replaced the large promotional hero with a compact Collection heading, creation
  action, refresh control, and expandable account details. The old wallet section
  was hidden by a global `.page-container` rule; the new layout makes it available.
- Artwork cards share Create's dark and mint palette. Prompt titles, media badges,
  readable dates, download controls, and an action menu replace the technical card
  presentation. Empty collections have an explicitly labeled inspiration collage.
- Search, media tabs, status, sorting, and native selection checkboxes remain
  available on phones. Card actions have 44px controls. Missing images show a
  fallback without preventing access to the item's details.
- Cached previews render immediately. Job and result requests run concurrently,
  individual cards update as they settle, and the detail refresh cancels after
  15 seconds or unmount. History synchronization has separate loading and error
  states, so a failed request is not presented as confirmed empty account history.
- Five regression tests cover progressive loading, filtering and selection,
  timeout recovery, failed history synchronization, and broken preview images.
  Full suite: **26 files / 141 tests passed**. TypeScript, production webpack build,
  and whitespace checks passed. Existing MetaMask optional-storage warning remains.
- Browser checks used isolated sample records and intercepted API responses;
  search, selection, action menu, and detail opening worked. There was no document
  overflow at 320, 390, 768, 1024, 1201, 1280, 1281, or 1440px. The 390px layout
  places the first artwork at 563px. Empty, populated, and desktop screenshots
  were visually reviewed. Collection axe scans in selection and action-menu states
  reported zero violations; image/gradient contrast remains a manual check.
- Live coordinator history, real media downloads, generation, and transactions
  remain unverified. No backend changes, transactions, or deployment were made.
  The development preview remains available on localhost port 3100.

### Continuing work

Discovery, music/video workspaces, the shared navigation, and homepage still need
the same visual review. Homepage positioning (creative tools first versus Astra
first) is an outstanding product preference; the existing positioning is unchanged.
Continue checking remaining global CSS rules route by route.

## September 17, 2026 — Discover and shared navigation

- Discover now uses a warm accent on the same dark studio surface, with a compact
  heading, one latest-release spotlight, and responsive artwork cards. The page
  renders all fetched publications once instead of repeating the first 12 songs
  across featured, popular, and new-release sections. The current API page is
  capped at 48; a visible note explains that limit when more songs exist.
- Search has an explicit submit action. Typing no longer triggers catalog reads
  (and wallet signatures for connected readers) on every keystroke. Genre state
  is announced, and the sort heading describes the chosen ordering accurately.
- Loading, unavailable service, no public songs, and unmatched filters have
  distinct presentations. Failed catalog reads offer Retry. Broken covers use
  the existing default artwork, and songs with no audio disable playback.
- Starting a song passes the available tracks to the existing player as a queue,
  preserving next/previous navigation. No live playback or account mutation was
  used for this visual pass; queue handoff is covered by an integration test.
- Shared navigation now has five direct destinations and a More disclosure on
  desktop. Phones show every destination in a two-column menu, including explicitly
  named Music library and Collection entries. The responsive breakpoint is 1000px.
  Native focus, Escape dismissal, outside presses, route changes, and current-page
  announcements are handled. Wallet controls no longer close the entire navigation
  just because a nested button was clicked.
- Reference: [Suno's Explore overview](https://help.suno.com/en/articles/3134721)
  describes genre and playlist browsing as quick listening entry points. It informed
  the interaction hierarchy; HavnAI's visuals and assets remain its own.
- Eight new regression tests cover full fetched-page rendering, playable queues,
  submitted search, unmatched results, retry, stale responses, cover fallback, and
  navigation behavior. Full suite: **28 files / 149 tests passed**. TypeScript,
  webpack production build, and whitespace checks passed. The existing MetaMask
  optional native-storage warning remains.
- Browser verification used eight isolated sample publications and intercepted
  catalog responses. No document overflow at 320, 390, 768, 1000, 1001, 1024, 1280,
  or 1440px. Mobile/desktop screenshots, menu states, and empty-state screenshots
  were visually reviewed. Search submitted the expected query. Escape returned
  focus to More. Automated axe found zero violations; image/gradient contrast
  remains a manual check, and an unresolved ARIA reference belongs to the Next.js
  development toolbar. Runtime error collection was empty for Discover.

All changes remain local. The coordinator is still unreachable from this machine;
live catalog contents, streaming audio, likes, saves, and publishing remain outside
the verified scope. Next: music/video workspaces and the homepage, while retaining
the homepage's existing Astra-first positioning until a different preference is given.

## September 17, 2026 — Music and Video Studio

- Both restricted studios now share an illustrated access screen with an explicit
  explanation of the access-key requirement and a useful public alternative. The
  key field no longer grabs focus and opens a phone keyboard on arrival. Music's
  Leave action now clears the in-memory key as well as session storage.
- Music uses the warm studio palette and a desktop composer/results layout.
  Three starter directions fill the description and style while preserving lyrics,
  length, and tuning. The empty state uses existing music artwork in a record motif.
  Recent-song cards were reviewed with successful and failed sample jobs.
- Video places the starting image, motion prompt, aspect, and duration first.
  Model, audio, quality, seed, and source preservation remain in an expandable
  section. Generate requires a prompt, source, and available model. An explicitly
  labeled inspiration image replaces the empty render frame before a source/job
  exists. Progress appears only for real job state; terminal status is visible.
- Added an explicit label for the source-preservation slider. Fixed low contrast
  on the optional-lyrics label and old tablet rules that stretched the music form.
- Four regression tests exercise saved music settings through starter selection
  and leaving, access retry, video essentials and advanced submission, and offline
  generation gating. Full suite: **29 files / 153 tests passed**. The final changed
  studio tests and production build passed after follow-up fixes; TypeScript and
  whitespace checks pass. Existing MetaMask optional-storage warning remains.
- Browser checks used an isolated studio key with intercepted capabilities and
  history, not a real access key. No jobs or publication actions were sent to the
  coordinator. Both workspaces fit 320, 390, 768, 1000, 1001, and 1440px without
  document overflow. At 390px, collapsed-form generate buttons end at about 832px.
  The final 768px music form ends its generate button at 862px after fixing legacy
  tablet layout rules. A local image was selected and settings were expanded and
  collapsed without losing the draft. Gate and populated-state screenshots were
  visually reviewed. Final axe scans of Music, Video, and the video access screen
  report zero violations; image/gradient contrast retains manual-review cases.
  Browser runtime error collection was empty.

### Homepage evidence for the next pass

The current homepage at 390px is about 5,758px tall and includes 30 image elements.
It still uses the older uppercase futuristic typography and cyan palette. Retain
its Astra-first positioning while improving hierarchy, adding clear music/tool
entry points, reducing repetitive showcase content, and aligning it with the new
studio style. A fresh baseline was saved as `havnai-home-audit-mobile.png` outside
the repository. No homepage edits were made in this pass.

## September 17, 2026 — Homepage

- Rebuilt the homepage around an Astra-led hero, three creative-tool cards,
  Collection, and the GPU network. Clear links reach image/video creation, the
  restricted video and music studios, Discover, and the existing Astra experience.
  The studio cards disclose the access-key requirement before navigation.
- Replaced the large uppercase typography and cyan marketing style with the
  calmer studio type scale, mint controls, and dark surfaces. Reorganized the
  footer into creation, personal work, and network links; retained contact/social
  destinations and the supporting product pages.
- Removed randomized asset swaps, the 18-outfit mosaic, and repeated pilot/ship
  showcases. These details remain on Astra's dedicated page. Main-content image
  elements fell from **30 to 6**. The hero uses Next Image priority loading; other
  artwork loads lazily with sizes matched to its actual responsive placement.
- Main mobile page height fell from **5,758px to 3,449px at 390px**, about 40% less
  scrolling. Tool cards become compact horizontal cards on phones. Artwork is
  identified as illustrative; the page does not present examples as user outputs.
- Kept optional live node/job figures when the analytics API supplies finite
  numbers. A failed/unavailable response omits the figures while all content and
  network links remain usable. Both response branches were checked with isolated
  browser interception; screenshot captures contain no invented network numbers.
- Browser checks: no overflow at 320, 390, 600, 601, 760, 761, 1000, 1001, and
  1440px; no broken loaded images; all 16 unique internal homepage/footer targets
  returned HTTP 200. Start creating navigated to the functional Create workspace.
  Phone, tablet, and desktop screenshots were reviewed. Axe detected zero
  violations; gradient/art contrast and Next's development-toolbar ARIA reference
  remain manual-review cases. Browser runtime error collection was empty.
- Existing full suite: **29 files / 153 tests passed**. TypeScript, production
  webpack build, and whitespace checks passed. The existing MetaMask optional
  native-storage import warning remains. No new implementation-mirroring tests
  were added for this presentation pass.

Changes remain local and undeployed. The broader overhaul still includes Astra's
dedicated page, marketplace/account surfaces, the music library and playlists,
and supporting product/network pages. Live backend generation and transactions
remain unverified; the visual goal has not been marked complete.

## September 17, 2026 — Astra destination

- Rebuilt Astra's dedicated page with the shared mint/dark visual direction,
  readable system typography, a separate combat-art panel, and a clear Play
  action. The game still opens in a new tab and retains the connected-wallet
  display hint; authentication remains the game's responsibility.
- Preserved the existing zone, pilot, reward-loop, marketplace, generator, and
  pricing content. Restored visible pilot portraits on phones using scoped
  styles instead of the old globally affected pilot classes. Universe artwork
  is labeled separately from live player renders.
- Local artwork uses responsive Next Image sources, reserved dimensions, and
  lazy loading below the priority hero. Zone and pilot cards adapt to wider
  horizontal layouts on tablets; phones use compact portrait rows. Optional
  live creations appear after the universe sections, with a readable fallback
  if an individual image fails.
- Browser checks covered 320, 390, 600, 601, 760, 761, 1000, 1001, and 1440px
  without horizontal overflow. Final tablet changes were rechecked at 601 and
  760px. All seven local artwork images decoded successfully. Phone, tablet,
  and desktop screenshots were visually reviewed.
- Verified the Explore anchor's destination and header clearance, both game
  links' destination/new-tab behavior, and optional feed success/failure using
  isolated browser fixtures. One valid remote image and one failed image
  produced the expected preview/fallback. An unavailable feed leaves the full
  marketing page usable; final screenshots contain no fixture player artwork.
- Axe reported zero violations, with artwork contrast and the existing Next
  development-toolbar ARIA reference needing manual review. Browser runtime
  error collection was empty. The full existing suite passed (29 files, 153
  tests), TypeScript passed, and the production webpack build passed with the
  existing MetaMask optional-storage warning. Whitespace checks passed.

This pass remains local and undeployed. Marketplace/account surfaces, music
library/playlists, and supporting pages still need the same visual review;
live generation, game rewards, and transactions are not verified here.

## September 17, 2026 — Marketplace

- Found that the late global `display: none !important` rules for `.page-container`
  and `.chart-section` hid the actual marketplace, leaving only its marketing
  hero. Replaced those affected wrappers on this page with scoped marketplace
  classes. Gallery, personal listings, owned assets, and workflow forms are now
  visible. The broad rules remain pending audits of the other affected routes.
- Replaced the oversized hero with a compact title and creation link. Added
  mint/dark styling, an expandable wallet/credits panel, clear browsing controls,
  responsive artwork cards, readable prices, workflow cards, and useful empty
  and unavailable states. Image failures use the existing Collection preview
  fallback. No sample listings were added to application data.
- Search now submits deliberately for both catalogs. Failed catalog requests
  display retry instead of also claiming there are no listings. Personal-list
  and owned-asset failures no longer display contradictory empty messages.
- Preserved transaction handlers, displayed prices, wallet requirements, original
  download controls, relisting, workflow configuration, and generator links.
  Purchase/connect controls sit directly after the listing preview. No real
  purchase, listing, workflow creation, or wallet signature was submitted.
- Listing/workflow cards are keyboard buttons; selected filters announce their
  state. Named modal dialogs trap Tab, close with Escape, return focus, and lock
  background scrolling. Corrected the inherited main stacking context so the
  details panel and Close control appear above the sticky site header.
- Removed the competing URL synchronization effect so a direct link retains its
  requested view. Ownership-history responses are scoped to the open listing;
  an older response can no longer overwrite a newer listing's provenance.
- Browser review covered populated gallery, workflow browsing/form, listing and
  workflow dialogs, empty gallery, failed gallery, and personal empty states.
  Screenshots with artwork listings use isolated fixtures. Verified layouts at
  320, 390, 480, 481, 760, 761, 1000, 1100, and 1440px without overflow. Confirmed
  personal panels render at 320px and direct links select the requested view.
- Axe found zero final violations in listing details and the workflow form;
  artwork contrast and the existing Next development-toolbar ARIA reference
  remain manual-review items. A fresh browser session reported no runtime errors
  after fixing a temporary JSX edit error during development.
- Seven new integration tests cover submitted search, catalog errors/retry,
  direct links, guest purchase restrictions, focus restoration, explicit purchase
  price/identity, image fallback, and stale ownership responses. Full suite:
  **30 files / 160 tests passed**. TypeScript, production webpack build, and
  whitespace checks passed. The existing MetaMask optional-storage warning remains.

Work remains local and undeployed. Live catalog contents and transaction execution
require a reachable coordinator; music-library and supporting-page visual work
remain part of the active goal.

## September 17, 2026 — Music library, playlists, and creators

- Brought the three listening destinations into Discover's warm visual system:
  compact library heading, clear Discover/library navigation, restrained creator
  and playlist heroes, readable artwork cards, and compact playlist track rows.
  Playlist editing is collapsed by default; owner reorder/remove controls remain
  available beside or beneath each track, with 44px touch targets.
- Added a direct Connect action to the library's guest state and visible
  connection errors. Library, creator, and playlist loading failures offer retry.
  A library failure no longer looks like an empty account. Switching wallets
  clears the previous wallet's visible songs and playlists before loading.
- Playlist create/update/delete/reorder failures now report an error; a failed
  creation preserves the typed name, and failed reordering preserves the list.
  Existing API payloads, wallet signatures, local search, playback queues, likes,
  saved state, and playlist mutations remain the underlying behavior.
- Updated the shared Add to Playlist dialog with the same styling, labeled input,
  direct wallet entry, retry, distinct unavailable/empty states, focus containment,
  Escape dismissal, focus return, and scroll locking. Fixed its duplicate banner
  landmark. Playlist cover failures fall back to existing cover artwork. Fixed
  collapsed artwork tiles and added an accessible image role to cover mosaics.
- Browser review included guest and populated library, owner playlist rows,
  creator catalog/playlists, and the add-to-playlist dialog. Populated states
  used isolated API fixtures; the saved library used an isolated simulated wallet
  and intercepted nonce/library responses. No real signature, playlist mutation,
  or publishing action was submitted.
- All three pages fit 320, 390, 760, 761, 1000, and 1440px without horizontal
  overflow. Phone and desktop screenshots were visually reviewed. Library,
  creator, and dialog accessibility scans reported zero violations; artwork
  contrast and Next's development-toolbar ARIA reference remain manual-review
  cases. Browser runtime error collection was empty.
- Seven new integration tests cover connection/error feedback, library retry and
  local search, playable queues, playlist draft retention, wallet changes, failed
  reordering, creator retry/sort, and dialog loading/errors/keyboard dismissal.
  Full suite: **31 files / 167 tests passed**. The targeted suite passed again
  after the final connection-error adjustment; TypeScript, production webpack
  build, and whitespace checks passed. The existing MetaMask optional-storage
  warning remains.

The overhaul remains local and undeployed. Supporting product, pricing, wallet,
and network pages still need visual review, including the remaining hidden global
page-container/chart-section rules. Real backend generation and signed music
operations remain unverified.

## September 17, 2026 - Pricing and wallet

- Replaced the oversized pricing hero with a compact heading, readable credit
  packages, per-job cost cards, and an expandable output comparison. Credit-to-HAI
  conversion also expands on demand. Existing funding, checkout, and conversion
  handlers remain in place, with labeled inputs and deployment/wallet restrictions.
- Removed the unsupported Best Value badge. Empty or failed cost responses no
  longer silently substitute old rates. Package and cost failures offer retry;
  example credit balances in the comparison are labeled when no packages exist.
- Restored wallet content hidden by legacy global page-container/chart-section
  rules using scoped account wrappers. Balances now precede the expandable guide;
  funding history, transaction links, rewards, and tester requests remain visible.
  Plain numeric typography replaces the old decorative balance font.
- Failed balances show an unavailable state and refresh action. Failed tester
  history no longer also claims the history is empty. Wallet connection failures
  are visible. Tables have keyboard-focusable horizontal scroll containers.
- Reviewed phone and desktop screenshots and expanded disclosures. Both pages fit
  320, 390, 760, 761, 1000, and 1440px without horizontal page overflow. Accessibility
  scans found zero violations; contrast and the Next development toolbar's ARIA
  reference were flagged for manual review. Browser runtime error collection was
  empty. Preview balances, packages, and rates used isolated API fixtures. No real
  checkout, signature, transfer, conversion, reward claim, or tester request ran.
- Six integration tests cover disabled guest actions, package retries, missing
  rates, balance refresh, failed request history, and retained funding transaction
  links. Full suite: **32 files / 173 tests passed**. TypeScript and whitespace
  checks passed.

The overhaul remains local and undeployed. Supporting product and network pages
still need visual review, including remaining hidden global wrapper rules. Real
backend generation and signed account operations remain unverified.

Production webpack build also passed. The existing MetaMask optional-storage warning remains.

## September 17, 2026 - Network and analytics dashboards

- Restored content hidden by the global page-container/chart-section rules with
  scoped network wrappers. Replaced the large network hero with compact navigation,
  four primary metrics, a health indicator, and direct access to node onboarding.
- Operator cards now prioritize GPU, memory, utilization, completed jobs, and
  recency. Full operator, reward, trust, and routing information remains in native
  expandable details. Execution claims and capacity/recovery metrics expand below
  the directory. Search works in both views; filtered leaderboard ranks are retained.
- Analytics now has a daily activity chart, model distribution bars, summary cards,
  credit usage, and reward tables. Days are selectable by keyboard or pointer; the
  chart scrolls to the latest day on phones, and dates scroll with the bars. The
  expandable data table contains the full returned period instead of only 14 rows.
- Verified reporting semantics against havnai-core/server/analytics.py: overview
  totals are cumulative, reward reporting defaults to 30 days, and the existing
  credit endpoint uses the configured site wallet. Labels distinguish these scopes
  from the selected job/credit period. No core changes were needed.
- Added abort support to the existing read APIs, a twelve-second request deadline,
  retry actions, and separate unavailable/empty states. Node requests start alongside
  summary and leaderboard requests; control telemetry refreshes independently,
  prevents overlapping polls, and cleans up pending requests on unmount. Retained
  existing SSE subscriptions and fixed partial GPU events replacing other metadata.
- Reviewed populated and unavailable phone screenshots, desktop screenshots,
  expanded execution data, and leaderboard tables. All checked widths (320, 390,
  760, 761, 1000, 1440px) fit without horizontal page overflow. Both dashboards'
  accessibility scans reported zero violations; contrast and development-toolbar
  ARIA checks remain manual-review cases. Browser runtime error collection was empty.
  Preview node identities, activity, and balances were isolated API fixtures, not
  production telemetry. No operator setup, financial action, or backend mutation ran.
- Seven integration tests cover node search/details, ranked wallet filtering,
  retry without false empty states, partial SSE updates, full-period chart data,
  day/range selection, partial report failures, and stalled-request timeout.
  Full suite: **33 files / 180 tests passed**. TypeScript and whitespace checks passed.

The overhaul remains local and undeployed. Node onboarding, rewards, receipt
anchors, and supporting product pages still need review. Real backend availability
and signed operations remain unverified.

Production webpack build passed for this dashboard pass. The existing MetaMask optional-storage warning remains.

## September 17, 2026 - Operator onboarding, rewards, and receipts

- Restored the hidden run-a-node guide with a desktop/terminal setup layout,
  hardware requirement cards, four setup steps, and expandable flags, maintenance
  commands, video setup, and FAQs. Existing install and post-install commands remain
  available, with a clipboard failure fallback and keyboard-scrollable code blocks.
- Reworked desktop downloads into explicit platform options. Missing installers
  and a failed release lookup are separate states; failed requests offer retry and
  time out after twelve seconds. iPhone/iPad user agents no longer recommend a Mac
  installer. Windows/WSL2 guidance follows havnai-core/desktop/README.md. The app's
  installer URLs still come from release assets; no installer was downloaded or run.
- Added consistent, shared navigation across all five network pages. Rewards and
  receipts now have responsive summary cards, ledger rows, status badges, readable
  transaction links, and grouped treasury controls. Receipt status filters and
  expandable full roots make batch review and copying practical on a phone.
- Ledger errors no longer imply empty history or zero rewards. Failed reward
  sections recover independently, wallet changes clear old claim data and live
  transaction display, and claims stay disabled for a different connected wallet.
  Async request versions and wallet identity guards reject stale results. Background
  verification avoids overlapping polls and ignores completions after cleanup.
  Existing transaction/signature handlers and authorization paths are retained.
- Reviewed empty/populated ledgers, receipt filtering/root copying, expanded
  treasury sections, setup commands, and download failure/retry states. All three
  pages fit 320, 390, 760, 761, 1000, and 1440px; full roots also fit at 320px.
  Phone and desktop screenshots were visually reviewed. All three accessibility
  scans reported zero violations; development-toolbar ARIA and some contrast checks
  remained manual-review cases. Browser runtime error collection was empty.
- Populated ledgers used isolated API fixtures. Download options were checked with
  an isolated in-page release response fixture after route mocking hit a cross-origin
  restriction. These previews do not assert that release assets or claim balances
  exist in production. No signature, claim, batch build, anchor, funding, or publishing
  transaction was submitted; automatic verification was avoided in browser fixtures.
- Nine integration tests cover release lookup/retry, clipboard errors, failed
  ledgers, wallet-switch races (including background confirmation completion),
  mismatched proof wallets, filters, full-root copying, and transaction links. Added
  an iOS platform-detection regression. Full suite: **34 files / 190 tests passed**.
  TypeScript, whitespace checks, and production webpack build passed. The existing
  MetaMask optional-storage warning remains.

The overhaul remains local and undeployed. Supporting product and explanatory
pages remain to be reviewed. Real backend generation, installation, and signed
operations remain unverified.

## September 17, 2026 - Image and video product pages

- Restored both product pages, which were hidden by legacy layout selectors.
  A shared responsive layout brings artwork, concise creative guidance, editable
  prompt cards, native expandable FAQs, and clear Create links into the same visual
  system as the rest of the site. Video artwork is explicitly labeled as concept
  frames, not generated clips. Reused the existing original illustration assets.
- Replaced stale product claims and removed unsubstantiated zero-price schema
  offers. Copy explains model availability and the separate studio-key workflow.
  Updated the vehicle/hangar inspiration prompt to match its actual artwork.
- Create accepts an initial mode and prompt from these links, applies them once,
  and keeps in-progress job or video-chain recovery ahead of a new entry prompt.
  Opening a prompt never submits generation. Invalid/repeated query values are
  ignored; subsequent editing is preserved.
- Reviewed mobile and desktop screenshots of both pages. Both fit 320, 390, 760,
  761, 1000, and 1440px without horizontal overflow. Accessibility scans reported
  zero violations, with development-toolbar ARIA and some contrast results left
  for manual review. Browser runtime error collection was empty.
- Browser checks verified image and video prompt links selected the intended mode
  and populated Create. No API POST requests were captured. Three regression tests
  cover query entry, invalid values, editing, and active-job recovery. Full suite:
  **34 files / 193 tests passed**. TypeScript, whitespace checks (respecting Windows
  line endings), and the production webpack build passed. The existing MetaMask
  optional-storage warning remains.

Changes remain local and undeployed. How It Works, Ownership, and Templates are
next for review. Real backend generation and signed operations remain unverified.

## September 17, 2026 - How It Works and Ownership

- Rebuilt both guides with visible, scoped layouts. How It Works now leads with
  original amber artwork, a three-step creative flow, and clear links to music,
  the marketplace, and Astra. Ownership uses two comparison cards, a visual Astra
  section, and native expandable FAQs. Both reuse the established product-page
  typography, colors, buttons, and footer with dedicated responsive guide styles.
- Replaced the outdated universal Library/Inbox/Claim pipeline and permanent-storage
  promises with current behavior. Generation history and wallet-owned gallery assets
  are explained separately, with direct links to the appropriate view. Grounded this
  copy in libraryStore, the current Collection and marketplace pages, core gallery.py,
  and Astra's CollectionScreen and owned-asset lookup. No backend files were changed.
- Visually reviewed phone and desktop screenshots. Both guides fit 320, 390, 760,
  761, 1000, and 1440px without horizontal overflow. Both accessibility scans returned
  zero violations; some contrast checks and development-toolbar ARIA remain manual
  review cases. The browser reported no runtime errors.
- Verified the owned-assets link selects Marketplace's My Collection view, the
  step anchor lands below the sticky header, and the native FAQ opens its answer.
  TypeScript, Windows-aware whitespace checks, and production webpack build passed.
  The existing MetaMask optional-storage warning remains. This static presentation
  change adds no application state or data mutation; no extra unit tests were added.

Changes remain local and undeployed. Templates still needs its visual pass. Inspection
also found its workflow-use link is redirected through /generator without preserving
the selection; address that handoff alongside the template experience. Actual backend
generation, marketplace transactions, and Astra ownership synchronization remain
unverified in this environment.

## September 17, 2026 - Templates and the Create handoff

- Restored the hidden template catalog with responsive cards, debounced search,
  category selection, pagination, a retryable error state, and distinct empty states.
  Native modal details provide configuration, prompts, creator information, and a
  direct Create link. Escape closes the dialog and focus returns to its card.
- Rebuilt the draft form with labeled fields, collapsed model settings, and a form
  that appears first on phones. Mobile fields use 16px text. Saving retains the draft
  through failure, uses the active wallet explicitly, rejects duplicate submissions,
  and ignores results after a wallet change or unmount. A saved template links to
  Create; saving does not publish it to the shared catalog.
- Create now fetches the selected workflow into an explicit review/apply panel.
  Applying validates mode, settings, and online model availability before changing
  the draft, and occurs after model defaults so imported values survive. Image
  steps/guidance overrides are visible and resettable; negative prompts are editable
  and included in image requests. Video and face-swap values use their existing
  controls. Unsupported categories are explained, and additional unimported settings
  (including face-swap negative prompts) are identified. Nothing auto-submits.
- Updated marketplace workflow links and preserved the selection through legacy
  /generator redirects. Workflow reads support cancellation; catalog and import
  components time out stalled reads after twelve seconds and ignore stale responses.
- Browser checks used isolated catalog/model fixtures. Confirmed the full template
  detail -> Create -> Apply path, including exact image prompt, negative prompt,
  steps, and guidance. No API POST requests were captured. Browsing and draft views
  fit 320, 390, 760, 761, 1000, and 1440px; expanded form fields and details also fit
  at 320px. Phone and desktop screenshots were visually reviewed. Catalog, draft,
  and detail accessibility scans reported zero violations, with development-toolbar
  ARIA and some contrast checks requiring manual review.
- Added nine regressions covering failure/retry, search races, draft preservation,
  wallet changes, settings validation, legacy links, exact submitted image values,
  unavailable models, and video defaults. Full suite: **35 files / 202 tests passed**.
  The two affected test files passed again after final layout changes. TypeScript,
  Windows-aware whitespace checks, and production webpack build passed. The existing
  MetaMask optional-storage warning remains.

Changes remain local and undeployed. Next is a site-wide consistency and navigation
audit against the original mobile-first visual objective. Live generation, template
saving, and marketplace transactions remain unverified; tests use isolated mocks.

## September 17, 2026 - Result review and shared navigation

- User feedback changed the priority: Templates has not been useful in practice.
  Keep it out of the main navigation and focus subsequent work on Create, reviewing
  results, and Collection. Existing template functionality remains available.
- Rebuilt the shared result drawer around the creation itself. The preview,
  download, and Save to Collection actions come first; settings, prompts, marketplace
  availability, and technical verification are expandable. Added honest media-error
  recovery, download feedback, stale-action guards, and distinct unknown status.
  The dialog traps keyboard focus, closes with Escape, and restores the opener.
- Updated wallet navigation with selectable addresses, accurate clipboard feedback,
  connection-error handling, and wallet/credits access. Wallet-menu Escape preserves
  the surrounding mobile navigation. Create and Collection retain their content
  when wallet connection fails. Added a branded recovery page for missing routes.
- Removed obsolete global rules that hid page and chart containers. Added clear
  Wallet and How it works destinations and renamed Credits to Credits & pricing.
  Templates is absent from both the main navigation and the new recovery page.
- Swept 23 routes at phone width for visible main content and horizontal overflow;
  this was a layout check, not confirmation that remote data loaded. Reviewed final
  mobile and desktop result screenshots. The drawer fits 320, 390, 760, 761, 1000,
  and 1440px. Result-dialog and recovery-page accessibility scans returned zero
  violations; development-toolbar ARIA and some contrast checks remain manual.
- Result checks used isolated job/history fixtures and an existing local image.
  Wallet-menu checks used an isolated in-memory wallet stub. No generation,
  publishing, real wallet signature, or transaction was triggered.
- Full suite: **37 files / 213 tests passed**. After final accessibility changes,
  the three directly affected files passed again (12 tests). TypeScript and the
  production webpack build passed. The existing MetaMask optional-storage warning
  remains. Browser result checks reported no runtime errors.

Changes remain local and undeployed. Continue with the everyday Create/result/
Collection experience rather than expanding the Templates workflow. Live generation
and backend-backed saving remain unverified because the coordinator is unavailable
from this environment.

## September 17, 2026 - Review branch preparation

- Updated the result card directly on Create to match the result drawer: artwork
  first, a prominent download button, 46px refinement/animation controls, and a
  collapsed full job ID. Downloads retain the returned media type. Preview retries
  preserve signed URLs; download, clipboard, and frame-capture failures explain how
  to recover. Switching results cancels stale work; video reads have bounded waits.
- Reviewed the result card on phone and desktop using an isolated local history
  fixture. The phone layout had no horizontal overflow and no browser errors.
  No live job was submitted. Five new action regressions cover media retry, download
  recovery, stale actions, denied clipboard access, and frame capture failure.
- Full suite: **38 files / 218 tests passed**. TypeScript and production compilation
  passed; the existing optional MetaMask native-storage warning remains.
- User requested a pushed branch to review the accumulated work. Prepared
  `design/mobile-visual-overhaul` from the existing music feature branch, preserving
  its nine commits above main. This includes the visual changes across the site and
  their supporting tests/assets; no core changes are required for this preview.

## September 17, 2026 - Deployed review and recent creations

- The overhaul is published on `design/mobile-visual-overhaul` with draft PR #104.
  The first preview (commit 0104b80) reached READY, and both GitHub CI runs passed.
  Production remains unchanged. On the deployed preview, live model lists loaded,
  inspiration populated the prompt, switching to Video preserved it, and the
  Collection empty state rendered correctly. Create, Collection, Discover, and Home
  fit 320px and 1440px without horizontal overflow or reported browser errors.
  These checks did not submit generation, spend credits, or test transactions.
- Updated Create's recent history with visible prompt titles and image/video
  labels. Failed media stays identifiable and its details remain accessible.
  Six desktop columns become three on tablets and two on narrow phones. Controls
  have explicit accessible names and selected state. Replaced the timed double-tap
  clear action with explicit confirmation and cancellation that explains its scope.
- Targeted history/Create regressions: 2 files / 14 tests passed; TypeScript passed.
  Production webpack build passed with the existing optional MetaMask warning.
  Browser fixtures include two local images and an intentionally unavailable video.
  Reviewed phone and desktop layouts; checked 320, 390, 760, 761, 1000, and 1440px.
  No horizontal overflow or unnamed history controls were found.

## September 17, 2026 - Mobile result-to-composer handoff

- Browser inspection found that Refine image populated the reference correctly but
  left focus on the result button with the prompt 1,764px above the phone viewport.
  Refine image, Animate image, and successful last-frame capture now return focus
  to the existing prompt and scroll it into view. They still require explicit
  generation and preserve the chosen reference.
- Create regressions: 12 tests passed, including a new saved-result handoff test
  that checks focus, image/video references, selected mode, and no submitted job.
  TypeScript passed. Browser checks use isolated local history, not real generation.

## September 17, 2026 - User-selected homepage artwork

- Replaced the homepage flight-deck scene with the user's exact Downloads/astra-cover.png
  artwork, stored as public/astra/home-pilots.png. The hero and social-share metadata
  use the new image. The dedicated Astra page retains its existing artwork.
- Preserved the full 4:3 composition at every breakpoint so all three pilots remain
  visible. Removed the extra gradient and top label; the caption uses the artwork's
  existing bottom fade. Reviewed phone and desktop screenshots and responsive fit.

## September 17, 2026 - Rounded navigation requested by user

- Restored the supplied rounded-bar direction: standalone logo, cyan active pill,
  outlined wallet action, and the requested Astra-first link order. Removed the
  duplicate HavnAI wordmark beside the icon. Library leads to music; Collection
  remains the image/video archive. Templates stays out of navigation.
- Navigation measures actual label and wallet widths with ResizeObserver and moves
  whole links into More before they overflow. It recalculates on resize and font
  readiness, including wallet-width changes. Narrow phones place the wallet action
  inside More. Every label uses one line, including Run a Node; no ellipsis is used.
- Retained outside dismissal, Escape focus return, active-page announcements, and
  route-change dismissal. Focus moves to More when resizing relocates the focused
  control. Dropdown height is bounded to the viewport and scrolls on short phones.
- Nine navigation/wallet regressions and TypeScript passed. Browser checks at 320,
  390, 600, 601, 760, 1000, 1001, 1280, 1440, and 1920px found no document overflow,
  clipped inline labels, or overlapping controls. The header accessibility scan
  returned zero violations, with gradient contrast flagged for manual review.
  Full suite: 39 files / 223 tests passed. Production webpack build passed with the
  existing optional MetaMask native-storage warning.

## September 17, 2026 - All navigation links without More

- Followed the revised preference to remove More entirely. All 13 destinations
  remain direct links in the rounded bar, with a standalone brand icon and cyan
  active state. Removed measurement observers, duplicate wallet controls, and
  disclosure state. Templates remains out of navigation.
- Wide screens use one header row. Smaller screens put the logo and wallet above
  a full-width navigation rail, which scrolls horizontally on phones. Labels stay
  on one line with no ellipsis; wallet dropdowns sit outside the scrolling rail.
- Reviewed desktop and phone screenshots and checked widths from 320 to 1920px.
  Every destination remains reachable, the wallet stays visible, and the document
  has no horizontal overflow. Browser reported no errors. Updated navigation
  regressions; all 39 test files / 220 tests passed. Production webpack build
  passed with the existing optional MetaMask native-storage warning.

## September 17, 2026 - Mobile viewport investigation

- User reported sideways movement in page content. Confirmed two viewport meta
  tags were emitted: Next.js's default and a second tag from _document. Moved the
  explicit width/device and initial-scale settings to next/head in _app so Next
  emits one consistent viewport declaration. Pinch zoom remains available.
- Browser checks at 390px found no document overflow on home, Create, Astra,
  Music, Discover, Collection, Video Studio, Marketplace, Network, or Run a Node.
  Home and expanded Create controls also fit 320px. Editable Create fields are
  16px. Navigation and code blocks retain their intentional internal scrolling.
- These checks have not reproduced the reported page panning; the specific page
  and phone/browser are still needed to confirm its cause on the user's device.

## September 17, 2026 - Restore the blue brand palette

- User confirmed the mobile issue cleared after refresh and requested the former
  blue theme. Restored the original cyan #00eaff and sky-blue #57d3ff as shared
  brand tokens. Updated the redesign's accents, buttons, focus rings, borders,
  muted text, and green-tinted surfaces to blue/navy across product pages.
- Music and Discover use the same cyan primary accent. Artwork, layout, responsive
  behavior, and navigation remain intact, including the user's Astra cover.
- Reviewed homepage desktop/mobile and Create phone screenshots. Create fits a
  390px viewport with no document overflow; browser reported no errors.

## September 17, 2026 - Network compatibility and Library wallet prompts

- Leaderboard requests now explicitly request format=json; the coordinator's
  default response is an HTML page. A 404 from the newer network-summary endpoint
  falls back to existing /nodes and /jobs/recent APIs for live capacity and queue
  counts. Unsupported recovery counters remain unavailable, not fabricated zeros.
- A missing advanced telemetry endpoint is identified as unsupported and no
  longer retried every 15 seconds. Transient failures still retry.
- Music Library now shares concurrent reads and reuses verified results in memory
  for 15 minutes. Wallet changes/disconnects and library mutations clear the cache;
  failures are not cached. No signatures or private data are persisted to storage.
- Library copy explains that reading is free. The legacy music nonce's amount=1
  is an authentication schema placeholder; its read handler deducts no credits.
  Marketplace listing prices are separate purchase amounts.
- Regression tests cover JSON leaderboard requests, legacy capacity fallback,
  offline-node exclusion, genuine server failures, cache expiry/invalidation,
  rejected signatures, and returning reads without another nonce request.
  Full web suite: 41 files / 226 tests passed.

## September 17, 2026 - Coordinator branch compatibility

- Discover/Library failures after switching coordinators were caused by the
  marketplace-only backend branch omitting the existing music feature commits.
  Combined both into core branch fix/marketplace-and-music and detached its test
  worktree so the user's node checkout can switch to that branch normally.
- Wallet nonce API errors now propagate directly instead of retrying providers
  and adding an unrelated wallet-extension hint. Unsupported music purposes
  explain that the coordinator needs its music update and no credits were charged.
- Backend combined branch: 42 tests plus 3 subtests passed. Frontend regression
  verifies unsupported music purpose fails once with the correct explanation.
