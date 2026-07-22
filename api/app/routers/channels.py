from fastapi import APIRouter, HTTPException

from app.models.schemas import PlaybackInfo
from app.services.mock_data import get_playback_info

router = APIRouter()


@router.get("/channels/{channel_id}/playback", response_model=PlaybackInfo)
def get_channel_playback(channel_id: str):
    info = get_playback_info(channel_id)
    if not info:
        raise HTTPException(status_code=404, detail="Channel not found")
    return info
