from app.models.schemas import Game, Channel, PlaybackInfo

MOCK_GAMES: list[Game] = [
    Game(
        id="game-1",
        title="Lakers vs Celtics",
        home_team="Los Angeles Lakers",
        away_team="Boston Celtics",
        league="NBA",
        status="Q3 5:42",
        is_live=True,
        start_time="2026-03-02T19:30:00Z",
    ),
    Game(
        id="game-2",
        title="Chiefs vs Eagles",
        home_team="Kansas City Chiefs",
        away_team="Philadelphia Eagles",
        league="NFL",
        status="4th 2:15",
        is_live=True,
        start_time="2026-03-02T20:00:00Z",
    ),
    Game(
        id="game-3",
        title="Arsenal vs Man City",
        home_team="Arsenal",
        away_team="Manchester City",
        league="Premier League",
        status="2nd Half 67'",
        is_live=True,
        start_time="2026-03-02T15:00:00Z",
    ),
]

MOCK_CHANNELS: list[Channel] = [
    # Game 1 channels
    Channel(
        id="ch-1a",
        game_id="game-1",
        name="The Baseline Cast",
        description="Independent NBA commentary with deep stats",
        language="en",
    ),
    Channel(
        id="ch-1b",
        game_id="game-1",
        name="Courtside Vibes",
        description="Casual fan-friendly commentary",
        language="en",
    ),
    # Game 2 channels
    Channel(
        id="ch-2a",
        game_id="game-2",
        name="Gridiron Breakdown",
        description="Tactical football analysis",
        language="en",
    ),
    # Game 3 channels
    Channel(
        id="ch-3a",
        game_id="game-3",
        name="The Prem Pod",
        description="Premier League specialist commentary",
        language="en",
    ),
    Channel(
        id="ch-3b",
        game_id="game-3",
        name="Comentario en Español",
        description="Spanish language commentary",
        language="es",
    ),
]

# Public domain / freely available test audio streams
# Using BBC World Service as a reliable live HLS stream for testing
# In production these would be real commentary stream URLs
TEST_STREAM_URL = "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service"

MOCK_PLAYBACK: dict[str, PlaybackInfo] = {
    ch.id: PlaybackInfo(
        channel_id=ch.id,
        stream_url=TEST_STREAM_URL,
        format="mp3",
        is_live=True,
        recommended_offset_ms=0,
    )
    for ch in MOCK_CHANNELS
}


def get_live_games() -> list[Game]:
    return [g for g in MOCK_GAMES if g.is_live]


def get_channels_for_game(game_id: str) -> list[Channel]:
    return [c for c in MOCK_CHANNELS if c.game_id == game_id]


def get_playback_info(channel_id: str) -> PlaybackInfo | None:
    return MOCK_PLAYBACK.get(channel_id)
