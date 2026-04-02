package com.indigo.app.data.repository

import com.indigo.app.data.api.ApiClient
import com.indigo.app.data.model.Channel
import com.indigo.app.data.model.Game
import com.indigo.app.data.model.PlaybackInfo

class GamesRepository {

    private val api = ApiClient.api

    suspend fun getLiveGames(): Result<List<Game>> = runCatching {
        api.getLiveGames()
    }

    suspend fun getChannels(gameId: String): Result<List<Channel>> = runCatching {
        api.getChannels(gameId)
    }

    suspend fun getPlayback(channelId: String): Result<PlaybackInfo> = runCatching {
        api.getPlayback(channelId)
    }
}
