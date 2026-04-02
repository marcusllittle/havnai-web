# Indigo — Product Definition

## One Sentence

Watch the game anywhere, turn on our commentary here.

## What Indigo Is

Indigo is a mobile companion app that provides alternate live commentary audio for sports games. Users watch the game on whatever platform they already use — cable, streaming, at a bar — and Indigo provides a separate audio layer they can listen to instead of or alongside the broadcast commentary.

**Indigo is broadcast-source agnostic.** Users are never asked what platform they are watching on.

## User Flow

1. User opens Indigo
2. User sees a list of live games
3. User taps a game
4. User sees game detail with commentary controls
5. User taps commentary ON — audio starts playing
6. User selects a commentary channel if multiple are available
7. User adjusts sync offset if audio is ahead/behind their video feed
8. User backgrounds the app — audio continues playing
9. User taps commentary OFF or closes the app — audio stops

## MVP Scope (v1)

### In Scope

- Android app (Kotlin, Jetpack Compose)
- Live game list screen
- Game detail screen
- Commentary ON/OFF toggle
- Commentary channel selector
- Play/pause control
- Manual sync controls: -5s, -1s, reset, +1s, +5s
- Playback status display
- Background audio playback
- Simple FastAPI backend
- Mock data support with path to live integrations
- Project documentation

### Out of Scope (v1)

- No game video playback in app
- No required stream-source selection (broadcast-source agnostic)
- No chat or social features
- No guest video / co-watching
- No creator marketplace
- No AI-generated commentary
- No betting integrations
- No smart TV / non-Android builds
- No auto-sync (manual only in v1)
- No user accounts / auth (v1 is anonymous)

## Assumptions

- Commentary audio streams are provided as HLS or similar HTTP streaming format
- One or more commentary channels exist per game (at minimum one mock channel)
- Backend serves game metadata and stream URLs; it does not generate or transcode audio
- Users handle their own video source — the app never touches video
