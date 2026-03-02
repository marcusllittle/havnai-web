from pydantic import BaseModel


class Game(BaseModel):
    id: str
    title: str
    home_team: str
    away_team: str
    league: str
    status: str  # e.g. "Q3 5:42", "2nd Half", "Live"
    is_live: bool
    start_time: str  # ISO 8601


class Channel(BaseModel):
    id: str
    game_id: str
    name: str
    description: str
    language: str


class PlaybackInfo(BaseModel):
    channel_id: str
    stream_url: str
    format: str  # "hls" or "mp3"
    is_live: bool
    recommended_offset_ms: int  # suggested sync offset, 0 = no suggestion
