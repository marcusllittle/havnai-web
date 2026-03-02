from fastapi import APIRouter, HTTPException

from app.models.schemas import Game, Channel
from app.services.mock_data import get_live_games, get_channels_for_game

router = APIRouter()


@router.get("/games/live", response_model=list[Game])
def list_live_games():
    return get_live_games()


@router.get("/games/{game_id}/channels", response_model=list[Channel])
def list_game_channels(game_id: str):
    channels = get_channels_for_game(game_id)
    if not channels:
        raise HTTPException(status_code=404, detail="Game not found or has no channels")
    return channels
