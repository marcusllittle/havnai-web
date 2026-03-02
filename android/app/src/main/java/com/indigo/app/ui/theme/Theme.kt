package com.indigo.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val IndigoColorScheme = darkColorScheme(
    primary = IndigoPrimary,
    secondary = IndigoSecondary,
    background = IndigoBackground,
    surface = IndigoSurface,
    surfaceVariant = IndigoSurfaceVariant,
    onPrimary = IndigoOnPrimary,
    onSurface = IndigoOnSurface,
    onSurfaceVariant = IndigoOnSurfaceVariant,
)

@Composable
fun IndigoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = IndigoColorScheme,
        typography = IndigoTypography,
        content = content,
    )
}
