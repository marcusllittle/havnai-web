package com.indigo.app.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.indigo.app.data.model.Channel
import com.indigo.app.data.model.Game
import com.indigo.app.data.model.PlaybackInfo
import com.indigo.app.data.repository.GamesRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class GameDetailUiState(
    val game: Game? = null,
    val channels: List<Channel> = emptyList(),
    val selectedChannel: Channel? = null,
    val playbackInfo: PlaybackInfo? = null,
    val commentaryEnabled: Boolean = false,
    val isPlaying: Boolean = false,
    val syncOffsetMs: Long = 0L,
    val isLoading: Boolean = true,
    val error: String? = null,
)

class GameDetailViewModel(private val gameId: String) : ViewModel() {

    private val repository = GamesRepository()

    private val _uiState = MutableStateFlow(GameDetailUiState())
    val uiState: StateFlow<GameDetailUiState> = _uiState

    init {
        loadGameDetail()
    }

    private fun loadGameDetail() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            // Load game info from the live games list
            val gamesResult = repository.getLiveGames()
            val game = gamesResult.getOrNull()?.find { it.id == gameId }

            if (game == null) {
                _uiState.update { it.copy(isLoading = false, error = "Game not found") }
                return@launch
            }

            // Load channels
            val channelsResult = repository.getChannels(gameId)
            channelsResult
                .onSuccess { channels ->
                    val selected = channels.firstOrNull()
                    _uiState.update {
                        it.copy(
                            game = game,
                            channels = channels,
                            selectedChannel = selected,
                            isLoading = false,
                        )
                    }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(
                            game = game,
                            isLoading = false,
                            error = e.message,
                        )
                    }
                }
        }
    }

    fun selectChannel(channel: Channel) {
        _uiState.update {
            it.copy(
                selectedChannel = channel,
                commentaryEnabled = false,
                isPlaying = false,
                playbackInfo = null,
            )
        }
    }

    fun toggleCommentary() {
        val current = _uiState.value
        if (current.commentaryEnabled) {
            // Turn off
            _uiState.update {
                it.copy(commentaryEnabled = false, isPlaying = false, playbackInfo = null)
            }
        } else {
            // Turn on — fetch playback info
            val channel = current.selectedChannel ?: return
            viewModelScope.launch {
                repository.getPlayback(channel.id)
                    .onSuccess { playback ->
                        _uiState.update {
                            it.copy(
                                commentaryEnabled = true,
                                isPlaying = true,
                                playbackInfo = playback,
                                syncOffsetMs = playback.recommendedOffsetMs.toLong(),
                            )
                        }
                    }
                    .onFailure { e ->
                        _uiState.update { it.copy(error = e.message) }
                    }
            }
        }
    }

    fun togglePlayPause() {
        _uiState.update { it.copy(isPlaying = !it.isPlaying) }
    }

    fun adjustSync(deltaMs: Long) {
        _uiState.update { it.copy(syncOffsetMs = it.syncOffsetMs + deltaMs) }
    }

    fun resetSync() {
        _uiState.update { it.copy(syncOffsetMs = 0L) }
    }

    class Factory(private val gameId: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return GameDetailViewModel(gameId) as T
        }
    }
}
