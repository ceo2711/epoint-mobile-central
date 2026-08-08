# Contexto — Mobile ePoint CRM

Repo git independiente: `https://github.com/ceo2711/epoint-mobile-central.git`  
Ramas: `release/1.0.0` (store client-only), `release/2.0.0` (base ciclo 2), `feature/admin-mobile` (staff/admin). **No hay deploy Heroku** (app Expo).

## Stack

- **Expo SDK ~54** · React Native 0.81 · React 19 · TypeScript
- Expo Router 6 (file-based) · Reanimated 4 · Secure Store · Localization
- Alias `@/*` → `./src/*` · `newArchEnabled: true` · scheme `epoint`
- UI real: **StyleSheet + `theme/tokens.ts`** (NativeWind está instalado pero casi no se usa)

> Docs correctas: https://docs.expo.dev/versions/v54.0.0/ (no v57).

## Arranque

```bash
cp .env.example .env
npm install
npx expo start          # tras cambiar .env: npx expo start -c
```

| Variable | Uso |
|----------|-----|
| `EXPO_PUBLIC_API_URL` | Base API **con** `/api/v1` (fallback). En dispositivo físico, si Expo va por LAN, la app usa la **misma IP que Metro** automáticamente |

Defaults (`src/lib/api-config.ts`): iOS/web → `localhost:8000`; Android emulador → `10.0.2.2:8000`.  
Dispositivo físico: IP LAN del PC + backend con `--host 0.0.0.0`.

Lint: `npm run lint` → `tsc --noEmit`.

## Estructura

```
app/
  (auth)/                 # login, 2FA, change-password (glass + desierto)
  (portal)/(tabs)/        # cliente: index, datos, documentos, tablero, cuenta
  (staff)/(tabs)/         # CRM: dashboard, clientes, prospectos, pagos, …
src/
  components/{shell,ui}/
  contexts/LanguageContext.tsx   # idioma del dispositivo
  features/{auth,boards,chat,clients,documents}/
  i18n/locales/{es,en}.ts
  lib/{api,api-config,appNavigation,auth-*}
  theme/tokens.ts
  types/api.ts
```

## Auth

- `AuthGlassShell` + `DesertBackground` (login / 2FA / change-password)
- Tokens: SecureStore (nativo) / localStorage (web)
- Flujo: login → 2FA opcional → `must_change_password` → portal o staff
- `CLIENT` → `/(portal)/(tabs)`; resto → `/(staff)/(tabs)/dashboard`

## Features

| Área | Notas |
|------|--------|
| Portal | datos (SSN), documentos, tablero kanban, cuenta + avatar |
| Staff | drawer `AppShell`; nav por permisos en `appNavigation.ts` |
| Chatbot | solo CLIENT — `FloatingChatWidget` + `useChatbot` |
| Documentos | `document-requirements.ts` + `UploadSourceSheet` / cámara-galería-archivos |
| i18n | `expo-localization`: `es`/`en` del teléfono; re-sync al volver a foreground. Sin switcher ES/EN |
| Boards | `KanbanBoard` + `CardDetailModal`; menciones `@` (asesor) en comentarios; suprime gesto atrás horizontal |
| Notificaciones | Campana + SSE; banner nativo local al llegar evento (también en Expo Go); push remoto Expo solo fuera de Expo Go (dev/prod build) |

## API

- `src/lib/api.ts`: fetch + refresh 401 + `X-Merchant-Id`
- Tipos: `src/types/api.ts`

## Design tokens

Espejo del web: cream `#faf8f5`, brown, brand green, gold — `src/theme/tokens.ts`.  
Auth: tipografía clara sobre fondo animado; contenedor glass transparente.
