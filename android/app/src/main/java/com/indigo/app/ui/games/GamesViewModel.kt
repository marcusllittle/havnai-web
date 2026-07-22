package com.indigo.app.ui.games

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.indigo.app.data.model.Game
import com.indigo.app.data.repository.GamesRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class GamesUiState(
    val games: List<Game> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
)

class GamesViewModel : ViewModel() {

    private val repository = GamesRepository()

    private val _uiState = MutableStateFlow(GamesUiState())
    val uiState: StateFlow<GamesUiState> = _uiState

    init {
        loadGames()
    }

    fun loadGames() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            repository.getLiveGames()
                .onSuccess { games ->
                    _uiState.value = GamesUiState(games = games, isLoading = false)
                }
                .onFailure { e ->
                    _uiState.value = GamesUiState(
                        isLoading = false,
                        error = e.message ?: "Failed to load games"
                    )
                }
        }
    }
}
