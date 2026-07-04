# RythuMitra – Smart Precision Farming (PRD)

## Overview
Expo React Native mobile app that connects Indian farmers to their fields via IoT soil sensors, delivers AI-powered fertilizer/crop recommendations, tracks a full crop cultivation timeline, and supports multi-language voice queries (English / Telugu / Hindi).

## Stack
- Frontend: Expo Router (SDK 54), React Native, expo-linear-gradient, expo-audio, expo-haptics, expo-blur, react-native-safe-area-context.
- Backend: FastAPI, MongoDB (motor), JWT auth (mobile+password, bcrypt).
- AI: Anthropic Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `emergentintegrations` + rule-based fallback.
- Voice: OpenAI Whisper-1 for STT (via EMERGENT_LLM_KEY).

## Screens
1. **Auth** – Login / Signup with mobile + password (branded green gradient hero).
2. **Home** – Greeting header, notifications, field selector, moisture/phosphorus alerts, IoT device card with connect + control (Start/Pause/Stop/Refresh/Sync), 2x2 live sensor grid (N/P/K/Moisture) updating every 4 s while connected.
3. **Advice** – Configure query (recommendation type, AI model, field) → generates soil health tiles + warning banner + prioritized recommendation cards from Claude Sonnet 4.5 (falls back to rule engine).
4. **Planner** – Wheat cultivation cycle: duration + today's day, overall progress bar, today's task card with Mark Done + Voice Guide, Daily Reminders toggle, vertical timeline stepper of all cultivation tasks.
5. **Profile** – Avatar + stats (Fields/Acres/Score), Personal Details, Farm Details, Device Info, Language toggle (EN / TE / HI), Logout.
6. **Voice FAB** – Floating mic (all screens) records via expo-audio, uploads to `/api/voice/transcribe`, returns Whisper transcript.

## MongoDB Collections
`users`, `fields`, `devices`, `sensor_readings`, `cycles`, `tasks`, `advice_history`.
All docs use UUID `id` field; `_id` is stripped from every response.

## API (all under `/api`)
- `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/me`
- `GET/POST /fields`
- `GET /devices`, `POST /devices/{id}/toggle`, `POST /devices/{id}/control`
- `GET /sensors/live?field_id=...`
- `POST /advice/generate`
- `GET /planner`, `POST /planner/complete`, `POST /planner/reminders`
- `POST /voice/transcribe`
