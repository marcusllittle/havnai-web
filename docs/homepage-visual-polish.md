# Homepage visual polish — September 22, 2026

Branch: `feature/homepage-visual-polish`, created from `6083ff2` before edits.
No changes to main, core services, generation/publication APIs, wallet behavior,
authentication, marketplace contracts, or route definitions.

## What changed

- `pages/index.tsx`: retained the three-pilot hero, headline, and both CTAs;
  removed redundant eyebrow/helper labels; replaced the Image Studio product
  visual with the supplied portrait; dedicated Music artwork; five-image
  portfolio instead of the lower character collage.
- `lib/homeShowcase.ts`: centralized swappable imagery, portfolio examples,
  and the optional preview-video source.
- `components/HomeVideoPreview.tsx`: lazy viewport-triggered playback, muted
  looping inline video, poster fallback, pause/play control, hidden-tab pause,
  reduced-motion preference handling and observer/listener cleanup.
- `styles/home.css`: responsive portrait cards, a compact portfolio grid,
  media aspect ratios, readable captions and preview controls.
- `public/home/`: supplied portrait and existing Astra images optimized to WebP,
  a dedicated vector music sleeve, and asset provenance/delivery instructions.
- `components/SiteHeader.tsx`, `styles/navigation.css`: grouped navigation with
  native keyboard-operable disclosures, outside-click and Escape dismissal,
  focus return, route-change dismissal and mobile layout.
- `components/__tests__/SiteHeader.test.tsx` and
  `components/__tests__/HomeVideoPreview.test.tsx`: route preservation,
  navigation dismissal and media lifecycle regression tests.

## Navigation

| Top-level item | Destinations |
| --- | --- |
| Create | Image `/create`, Video `/video-studio`, Music `/music` |
| Discover | `/discover` |
| Astra | `/astra` |
| Marketplace | `/marketplace` |
| Network | `/nodes`, `/run-a-node`, `/how-it-works` |
| Your Havn | Library `/music/library`, Collection `/library`, Wallet `/wallet`, Credits `/pricing` |

All 13 former navigation destinations retain their exact URLs. WalletButton is
unchanged. The footer also retains explanatory, pricing, ownership, and network
links. Native disclosures work with keyboard activation; Escape closes the
panel and restores focus. Mobile uses two rows of three items rather than
horizontal scrolling or truncated words.

## Assets still needed

The final HavnAI-generated preview clip and its matching poster are still to be
supplied. Until then, Video Studio honestly displays its existing Astra poster,
with no fake motion, dead play button, or missing-file request. Set `homeVideo.src`
when the clip is ready. See `public/home/README.md` for exact paths, encoding,
size targets, and the audit of shared artwork across music surfaces.

The music sleeve is a new illustration, not represented as a generated song.
The homepage disclosure preserves the distinction between creative inspiration
and guaranteed model output.

## Verification

- Final full test suite: 272 passed across 48 files; media/navigation coverage
  includes 10 tests.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; all existing pages remain in the route output.
- `git diff --check`: passed.
- `npm run lint`: attempted, unavailable because this repository has no lint
  script or configured lint runner. This is not reported as a lint pass.
- Browser checks: 320px, 390px and 1440px viewports; document width equals viewport
  width; no horizontal overflow. All six top-level nav targets are at least 44px
  high. Create disclosure exposes Image, Video and Music; Escape closes it and
  returns focus. All 13 navigation links are present. Clicking grouped Music
  reaches `/music` and its unchanged studio access gate. Browser error log is empty.
- All nine homepage images load; below-fold images are lazy and responsive
  image candidates are used. Video placeholder produces zero MP4/WebM requests.
- Video regression tests cover viewport entry/exit, missing source, muted/loop/
  inline attributes, reduced-motion changes, hidden tabs, playback rejection,
  media failure, manual pause and effect cleanup.

Browser screenshots were captured at desktop, mobile and small-mobile widths.
The in-app browser connection was unavailable; the agent-browser CLI provided
the visual verification.
