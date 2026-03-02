package com.indigo.app.player

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer

/**
 * Manages audio playback for commentary streams.
 * Wraps ExoPlayer with sync offset support.
 */
class AudioPlayerManager(context: Context) {

    private val player: ExoPlayer = ExoPlayer.Builder(context).build()

    private var currentUrl: String? = null
    private var syncOffsetMs: Long = 0L

    fun play(streamUrl: String) {
        if (streamUrl != currentUrl) {
            currentUrl = streamUrl
            val mediaItem = MediaItem.fromUri(streamUrl)
            player.setMediaItem(mediaItem)
            player.prepare()
        }
        player.play()
    }

    fun pause() {
        player.pause()
    }

    fun stop() {
        player.stop()
        currentUrl = null
    }

    @OptIn(UnstableApi::class)
    fun setSyncOffset(offsetMs: Long) {
        syncOffsetMs = offsetMs
        // For live streams, we simulate offset by seeking relative to current position.
        // In a more sophisticated implementation, this would use ExoPlayer's
        // setPlaybackParameters or a custom render offset.
        // For MVP, we apply a simple seek when offset changes.
        if (player.isPlaying || player.playbackState == Player.STATE_READY) {
            val target = player.currentPosition + (offsetMs - syncOffsetMs)
            if (target >= 0) {
                player.seekTo(target)
            }
        }
    }

    fun release() {
        player.release()
    }
}
