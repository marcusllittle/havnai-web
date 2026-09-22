# Homepage showcase assets

Selection lives in `lib/homeShowcase.ts`. These assets are specific to the public
homepage; changing them does not replace generated music covers or studio output.

## Images and provenance

- `portrait.webp`: the user's supplied male portrait (`image-1.png`, attachment
  `6def85bd-e80d-486f-86f2-7d624624d907`). Converted without cropping or semantic
  changes to WebP quality 85, 832 × 1216, 101,838 bytes. The HavnAI watermark is
  preserved in the file. Preferred Image Studio visual and portfolio portrait.
- `spaceport.webp`: optimized existing `public/astra/scenes/spaceport_hub.png`,
  1152 × 896, 207,512 bytes. Current video poster and world-building example.
- `interceptor.webp`: optimized existing `public/astra/ships/astra_interceptor.png`,
  600 × 877, 101,348 bytes. Game artwork in the portfolio.
- `music-sleeve.svg`: original lightweight vector record-sleeve illustration made
  for this presentation pass. Illustrative cover art, **not** a generated song or
  a claim about a specific model's output. Independent of the shared player cover.
- The portfolio product image reuses `public/create/amber-still-life.webp`.
  See that directory's README for its generation provenance.

The Astra hero remains `public/astra/home-pilots.png`, unchanged. Homepage artwork
is labelled as selected artwork and creative inspiration, not uniformly claimed
to be output from the current generation models.

## Final Video Studio preview still needed

No approved homepage MP4/WebM was present in `public` at inspection. The card
currently shows the spaceport poster without a missing-video request, simulated
motion, or a misleading play button.

Supply a real HavnAI-generated 6–10 second seamless showcase clip at
`public/home/video-preview.mp4` and set `homeVideo.src` to
`/home/video-preview.mp4` in `lib/homeShowcase.ts`. Prefer a dramatic environmental
transformation, camera move, or image-to-video scene with evident motion. Supply
a matching `public/home/video-poster.webp` and update `homeVideo.poster` and `alt`.

Delivery target: H.264 MP4, yuv420p, fast-start metadata, no audio track,
24–30 fps, maximum 1280 px long edge, ideally below 2 MB. Keep the visual subject
inside the central portrait-safe area: the desktop card crops to 4:5, while
mobile uses 4:3. Check the final clip in both layouts before committing it.

`HomeVideoPreview` mounts the video only after entering the viewport, with muted,
loop, playsInline and preload="none". It pauses offscreen, in hidden tabs, and
when the user presses Pause. Reduced-motion users receive the poster and no
video request. Missing/unsupported video and autoplay denial retain the poster.
The poster is a lazy Next Image in a reserved aspect-ratio container.

## Music artwork audit

The old homepage used `/music-default-cover.png` (2.59 MB) directly. It now has
its own configurable artwork. Existing music functionality is unchanged:

- `pages/music.tsx`: hard-coded shared image in the empty state, job covers,
  playback metadata and publishing dialog.
- `components/StudioAccessGate.tsx`: shared cover for the music gate.
- `components/MusicPlayer.tsx`: fallback if a track lacks artwork.
- `components/MusicPublicationCard.tsx`: uses `cover_art_url`, shared fallback.
- `components/MusicPlaylistArtwork.tsx`: uses playlist artwork/tiles, shared
  fallback on image failure.
- Discover, Music Library, creator and playlist pages pass publication artwork
  to the player and use the shared cover only as a fallback.

Distinct track artwork is already supported on publication/playlist surfaces;
generation, upload and publishing changes are outside this homepage-only pass.
