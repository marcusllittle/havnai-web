package com.indigo.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Game(
    val id: String,
    val title: String,
    @SerialName("home_team") val homeTeam: String,
    @SerialName("away_team") val awayTeam: String,
    val league: String,
    val status: String,
    @SerialName("is_live") val isLive: Boolean,
    @SerialName("start_time") val startTime: String,
)

@Serializable
data class Channel(
    val id: String,
    @SerialName("game_id") val gameId: String,
    val name: String,
    val description: String,
    val language: String,
)

@Serializable
data class PlaybackInfo(
    @SerialName("channel_id") val channelId: String,
    @SerialName("stream_url") val streamUrl: String,
    val format: String,
    @SerialName("is_live") val isLive: Boolean,
    @SerialName("recommended_offset_ms") val recommendedOffsetMs: Int,
)
