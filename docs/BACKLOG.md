# Indigo — Backlog

## Epic: MVP Live Commentary Companion

**Goal:** Ship an Android app where users can open the app, see live games, and listen to alternate commentary audio with manual sync controls.

---

### Story 1: Project Setup

**As a** developer
**I want** the repo scaffolded with backend and Android projects
**So that** I can begin building features immediately

**Tasks:**
- [x] Create repo structure (android/, api/, docs/)
- [x] Create project documentation (PRODUCT, ARCHITECTURE, BACKLOG, RUNBOOK)
- [x] Scaffold FastAPI project with health endpoint
- [x] Scaffold Android project with Compose and navigation
- [x] Verify both projects run independently

**Acceptance Criteria:**
- `uvicorn` starts and `/health` returns 200
- Android app builds and shows empty screen

---

### Story 2: Live Games List

**As a** user
**I want** to see a list of currently live games
**So that** I can pick the game I'm watching

**Tasks:**
- [x] Implement `GET /games/live` with mock data
- [x] Create Android GamesListScreen with game cards
- [x] Wire Android to call backend API
- [x] Show live indicator and game status

**Acceptance Criteria:**
- App shows list of 2-3 mock live games
- Each game shows title, teams, live badge, and status
- Tapping a game navigates to detail screen

---

### Story 3: Game Detail + Commentary Controls

**As a** user
**I want** to see game details and control commentary
**So that** I can turn commentary on/off and pick a channel

**Tasks:**
- [x] Implement `GET /games/{id}/channels` with mock data
- [x] Create GameDetailScreen UI
- [x] Add commentary ON/OFF toggle
- [x] Add channel selector (dropdown or list)
- [x] Show playback status

**Acceptance Criteria:**
- Detail screen shows game info and channels
- Toggle turns commentary on/off
- Channel selector switches between available channels
- Playback status reflects current state

---

### Story 4: Sync Controls

**As a** user
**I want** to adjust audio sync manually
**So that** commentary matches my video feed

**Tasks:**
- [x] Add sync offset display to detail screen
- [x] Add -5s, -1s, Reset, +1s, +5s buttons
- [x] Wire buttons to modify playback offset

**Acceptance Criteria:**
- Offset displays in seconds (e.g., +2.0s)
- Each button adjusts offset correctly
- Reset returns to 0.0s

---

### Story 5: Audio Playback

**As a** user
**I want** to hear commentary audio when I turn it on
**So that** I get the alternate commentary experience

**Tasks:**
- [x] Implement `GET /channels/{id}/playback` returning stream URL
- [x] Integrate Media3 ExoPlayer in Android
- [x] Wire commentary toggle to start/stop playback
- [x] Add play/pause control
- [x] Apply sync offset to player

**Acceptance Criteria:**
- Audio plays from stream URL when commentary is ON
- Play/pause works
- Sync offset adjusts playback position
- Audio stops when commentary is OFF

---

### Story 6: Background Playback

**As a** user
**I want** commentary to keep playing when I leave the app
**So that** I can watch the game on my TV while listening

**Tasks:**
- [x] Implement MediaSessionService for background audio
- [x] Add foreground notification for playback
- [x] Ensure playback survives app backgrounding

**Acceptance Criteria:**
- Audio continues when app is backgrounded
- Notification shows with playback controls
- Returning to app shows correct playback state

---

### Story 7: Documentation + Run Steps

**As a** developer
**I want** clear docs on how to run and test everything
**So that** anyone can pick up the project

**Tasks:**
- [x] Write RUNBOOK with backend run steps
- [x] Write RUNBOOK with Android run steps
- [x] Document mock mode vs live mode
- [x] Add troubleshooting notes

**Acceptance Criteria:**
- New developer can run backend in < 5 minutes
- New developer can build Android app following docs
- Mock mode works without external dependencies

---

## Deferred from MVP

- User accounts / authentication
- Auto-sync (audio fingerprinting, timecodes)
- iOS app
- Chat / social features
- Creator tools / marketplace
- AI-generated commentary
- Smart TV apps
- Analytics / telemetry
- Push notifications
- Offline support
