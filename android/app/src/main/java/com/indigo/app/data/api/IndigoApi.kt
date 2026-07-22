package com.indigo.app.data.api

import com.indigo.app.data.model.Channel
import com.indigo.app.data.model.Game
import com.indigo.app.data.model.PlaybackInfo
import retrofit2.http.GET
import retrofit2.http.Path

interface IndigoApi {

    @GET("games/live")
    suspend fun getLiveGames(): List<Game>

    @GET("games/{gameId}/channels")
    suspend fun getChannels(@Path("gameId") gameId: String): List<Channel>

    @GET("channels/{channelId}/playback")
    suspend fun getPlayback(@Path("channelId") channelId: String): PlaybackInfo
}
