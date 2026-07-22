# Indigo — Runbook

## Backend (FastAPI)

### Prerequisites

- Python 3.11+
- pip

### Setup

```bash
cd api
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run (Development)

```bash
cd api
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API will be available at `http://localhost:8000`.
Docs at `http://localhost:8000/docs` (Swagger UI).

### Mock Mode vs Live Mode

The backend runs in **mock mode by default**. All data is served from `app/services/mock_data.py`.

To switch to live integrations (future):
- Set environment variable `INDIGO_MODE=live`
- Implement real data sources in corresponding service modules
- Mock mode remains the fallback

### Verify

```bash
curl http://localhost:8000/health
# {"status":"ok"}

curl http://localhost:8000/games/live
# Returns list of mock live games
```

---

## Android App

### Prerequisites

- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34

### Setup

1. Open Android Studio
2. Open project: select `android/` directory
3. Let Gradle sync complete
4. Connect a device or start an emulator (API 26+)

### Run

1. Select `app` run configuration
2. Click Run (or `Shift+F10`)
3. App launches on device/emulator

### Configure Backend URL

By default the app points to `http://10.0.2.2:8000` (Android emulator localhost alias).

To change:
- Edit `android/app/src/main/java/com/indigo/app/data/api/ApiClient.kt`
- Update `BASE_URL` to your backend address

For physical device testing, use your machine's local IP (e.g., `http://192.168.1.100:8000`).

### Build APK

```bash
cd android
./gradlew assembleDebug
# APK at app/build/outputs/apk/debug/app-debug.apk
```

---

## Testing the Full Flow

1. Start the backend: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. Start the Android emulator
3. Run the app from Android Studio
4. You should see a list of live games
5. Tap a game → see detail screen with commentary controls
6. Turn commentary ON → audio should start playing
7. Adjust sync → offset changes and player seeks
8. Background the app → audio continues
9. Return to app → state is preserved

---

## Troubleshooting

| Problem | Solution |
|---|---|
| App can't reach backend | Check `BASE_URL` in ApiClient.kt. For emulator use `10.0.2.2`. For device use machine IP. Ensure backend is running on `0.0.0.0`. |
| No audio playing | Check logcat for ExoPlayer errors. Verify stream URL is reachable. Test URL in browser. |
| Gradle sync fails | Ensure JDK 17 is set in Android Studio. Check internet connection for dependency downloads. |
| Backend won't start | Check Python version (3.11+). Ensure venv is activated. Run `pip install -r requirements.txt` again. |
| Background audio stops | Check battery optimization settings for the app. Some OEMs kill background services aggressively. |
| Sync feels wrong | Sync is manual in v1. Adjust by ear using -1s/+1s buttons. Larger offsets use -5s/+5s. |
