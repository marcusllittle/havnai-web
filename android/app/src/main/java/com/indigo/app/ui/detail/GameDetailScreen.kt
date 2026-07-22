package com.indigo.app.ui.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.indigo.app.player.AudioPlayerManager
import com.indigo.app.ui.components.LiveBadge
import com.indigo.app.ui.theme.IndigoLive
import com.indigo.app.ui.theme.IndigoSuccess

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun GameDetailScreen(
    gameId: String,
    onBack: () -> Unit,
    viewModel: GameDetailViewModel = viewModel(factory = GameDetailViewModel.Factory(gameId)),
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val playerManager = remember { AudioPlayerManager(context) }

    // Manage player lifecycle based on UI state
    DisposableEffect(uiState.commentaryEnabled, uiState.playbackInfo, uiState.isPlaying) {
        val playback = uiState.playbackInfo
        if (uiState.commentaryEnabled && playback != null) {
            if (uiState.isPlaying) {
                playerManager.play(playback.streamUrl)
            } else {
                playerManager.pause()
            }
        } else {
            playerManager.stop()
        }
        onDispose { }
    }

    // Apply sync offset
    DisposableEffect(uiState.syncOffsetMs) {
        playerManager.setSyncOffset(uiState.syncOffsetMs)
        onDispose { }
    }

    // Clean up player when leaving screen
    DisposableEffect(Unit) {
        onDispose { playerManager.release() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.game?.title ?: "Game") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        if (uiState.isLoading) {
            Box(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            // Game info header
            val game = uiState.game
            if (game != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = game.league,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    if (game.isLive) LiveBadge()
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = game.status,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Commentary toggle
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(
                            text = "Commentary",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Text(
                            text = if (uiState.commentaryEnabled) "On" else "Off",
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (uiState.commentaryEnabled) IndigoSuccess
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Switch(
                        checked = uiState.commentaryEnabled,
                        onCheckedChange = { viewModel.toggleCommentary() },
                        colors = SwitchDefaults.colors(
                            checkedTrackColor = MaterialTheme.colorScheme.primary,
                        ),
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Channel selector
            if (uiState.channels.isNotEmpty()) {
                Text(
                    text = "Channel",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    uiState.channels.forEach { channel ->
                        FilterChip(
                            selected = channel.id == uiState.selectedChannel?.id,
                            onClick = { viewModel.selectChannel(channel) },
                            label = { Text(channel.name) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MaterialTheme.colorScheme.primary,
                                selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                            ),
                        )
                    }
                }
                uiState.selectedChannel?.let { ch ->
                    Text(
                        text = ch.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Playback controls
            if (uiState.commentaryEnabled) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        // Play/Pause
                        IconButton(
                            onClick = { viewModel.togglePlayPause() },
                        ) {
                            Icon(
                                imageVector = if (uiState.isPlaying) Icons.Default.Pause
                                else Icons.Default.PlayArrow,
                                contentDescription = if (uiState.isPlaying) "Pause" else "Play",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier
                                    .width(48.dp)
                                    .height(48.dp),
                            )
                        }

                        Text(
                            text = if (uiState.isPlaying) "Playing" else "Paused",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Sync controls
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = "Sync Offset",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        // Offset display
                        val offsetSec = uiState.syncOffsetMs / 1000.0
                        val sign = if (offsetSec >= 0) "+" else ""
                        Text(
                            text = "$sign%.1fs".format(offsetSec),
                            style = MaterialTheme.typography.headlineLarge.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 32.sp,
                            ),
                            color = if (uiState.syncOffsetMs == 0L)
                                MaterialTheme.colorScheme.onSurface
                            else MaterialTheme.colorScheme.primary,
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Sync buttons
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            OutlinedButton(onClick = { viewModel.adjustSync(-5000L) }) {
                                Text("-5s")
                            }
                            OutlinedButton(onClick = { viewModel.adjustSync(-1000L) }) {
                                Text("-1s")
                            }
                            Button(
                                onClick = { viewModel.resetSync() },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (uiState.syncOffsetMs != 0L)
                                        IndigoLive
                                    else MaterialTheme.colorScheme.surfaceVariant,
                                ),
                            ) {
                                Text("Reset")
                            }
                            OutlinedButton(onClick = { viewModel.adjustSync(1000L) }) {
                                Text("+1s")
                            }
                            OutlinedButton(onClick = { viewModel.adjustSync(5000L) }) {
                                Text("+5s")
                            }
                        }
                    }
                }
            }
        }
    }
}
