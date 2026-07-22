# Indigo — Architecture

## System Overview

```
┌─────────────┐       HTTPS/JSON       ┌──────────────┐
│  Android App │ ◄──────────────────► │  FastAPI      │
│  (Kotlin)    │                       │  Backend      │
└──────┬───────┘                       └──────┬────────┘
       │                                      │
       │  HLS stream URL                      │  Returns stream
       ▼                                      │  metadata + URLs
┌──────────────┐                              │
│  Media3 /    │ ◄────────────────────────────┘
│  ExoPlayer   │
│  (audio)     │
└──────────────┘
```

The system has two components:

1. **FastAPI Backend** — serves game listings, commentary channel metadata, and playback URLs
2. **Android App** — displays games, manages commentary controls, plays audio via Media3

There is no video component. The app is audio-only.

## Android Responsibilities

| Concern | Approach |
|---|---|
| UI | Jetpack Compose, single-activity |
| Navigation | Compose Navigation (games list → game detail) |
| Networking | Retrofit + kotlinx.serialization |
| Audio playback | Media3 ExoPlayer (HLS support built in) |
| Background audio | Media3 MediaSessionService |
| Sync control | Local offset applied to ExoPlayer seek position |
| State management | ViewModels + StateFlow |
| DI | Manual (Hilt is overkill for MVP) |

### Screen Map

```
LiveGamesScreen  →  GameDetailScreen
     │                    │
     │                    ├── Commentary ON/OFF
     │                    ├── Channel selector
     │                    ├── Sync controls
     │                    ├── Play/Pause
     │                    └── Playback status
     │
     └── Pull-to-refresh (future)
```

## Backend Responsibilities

| Concern | Approach |
|---|---|
| Framework | FastAPI (Python) |
| Data | Mock data in v1, DB-backed later |
| Endpoints | REST JSON |
| Auth | None in v1 |
| Hosting | Local dev / any Python host |

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/games/live` | List currently live games |
| GET | `/games/{game_id}/channels` | List commentary channels for a game |
| GET | `/channels/{channel_id}/playback` | Get playback URL + metadata for a channel |
| GET | `/health` | Health check |

## Audio Stream Flow

1. App calls `GET /games/live` → gets list of games
2. User taps a game → app calls `GET /games/{id}/channels` → gets channels
3. User enables commentary → app calls `GET /channels/{id}/playback` → gets stream URL
4. App feeds stream URL to Media3 ExoPlayer
5. ExoPlayer plays HLS audio stream
6. Audio continues in background via MediaSessionService

## Sync Model (v1)

Sync is **manual and local-only**.

- User sees current offset (e.g., `+2.0s`)
- Buttons: -5s, -1s, Reset, +1s, +5s
- Offset is applied by seeking ExoPlayer forward/backward relative to live edge
- Reset sets offset to 0 (live edge)
- No auto-sync in v1
- Backend may optionally return a `recommended_offset_ms` field per channel — app can use it as default but user always overrides

### Known limitation

Manual sync means the user must adjust by ear. This is acceptable for MVP. Auto-sync (fingerprinting, timecodes) is a v2 feature.

## Known Risks

| Risk | Mitigation |
|---|---|
| Audio latency varies by user's video source | Manual sync controls; document limitation |
| HLS stream reliability | Use ExoPlayer retry/buffering defaults; test with known-good streams |
| Background playback battery drain | Media3 handles this well; monitor in testing |
| No auth means no user data | Acceptable for MVP; add auth in v2 |
| Mock data may not cover edge cases | Keep mock data realistic; add error states |
