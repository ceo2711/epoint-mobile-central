# Contexto — Mobile ePoint CRM

Repo git independiente: `https://github.com/ceo2711/epoint-mobile-central.git`  
**No hay deploy Heroku** (app Expo / EAS).

## Ramas (crítico)

| Rama | Uso |
|------|-----|
| `release/1.0.0` | **Store iOS 1.0.** Portal cliente only. **No** meter cursos/player acá. |
| `release/2.0.0` | Base ciclo 2 / dev. |
| `feature/cursos-mentorias` | Cursos/mentorías en portal. Para **web/2.0**, no para el IPA de store 1.0. |
| `feature/admin-mobile` | Staff/admin. |

**Nunca** enviar `feature/cursos-mentorias` a App Store como versión 1.0: Apple ya rechazó **3.1.1 IAP**.

Registro completo (versiones, Play, cursos): [`docs/VERSIONS.md`](../docs/VERSIONS.md).  
**Toma y dame con Apple (hilo, replies, próximo texto):** [`docs/APP_REVIEW.md`](../docs/APP_REVIEW.md).  
Comandos EAS: [`docs/STORE_DEPLOYMENT.md`](../docs/STORE_DEPLOYMENT.md).

## App Review (resumen — el hilo entero está en APP_REVIEW.md)

- Binario en review: **1.0 (13)**. Submission ID `d13dde36-a0cf-4da8-8824-7378f5e0717e`. Rama store: `release/1.0.0`.
- 26 ago: Apple **insistió 3.1.1**. No se colaron cursos en el IPA (cursos en git = 25 ago). Causa: Support URL `epointsolution.com` vende programas educativos.
- **No** decirles que los cursos se ven en la web. Eso confirma 3.1.1. Reply listo en `docs/APP_REVIEW.md`.
- Reply sin **Actualizar revisión** no vuelve a la cola. Mismo build 13. Nunca `feature/cursos-mentorias`.

## Versiones (resumen — el detalle está en VERSIONS.md)

- **Store 1.0.0** = rama `release/1.0.0` + IPA **build 13** (portal cliente, iPhone only, sin Authenticator en CLIENT). En review.
- **Ciclo 2** = rama `release/2.0.0` (staff/admin). No hay IPA 2.0.
- **Esta rama** = cursos/mentorías + esos fixes de review. No submitear como 1.0.
- Demo Apple: `appreview@epoint.com` / `AppReview123!`. Nunca `guaniquediaz@gmail.com` en Notes.
- `release/1.0.0` en git **no** tiene todavía `supportsTablet: false` ni el skip 2FA CLIENT; el IPA 13 sí. Otro IPA 1.0 = cherry-pick esos dos, **sin** tabs de cursos.

## Estado cursos en esta rama

Tabs `cursos.tsx` (player 12×36 + WebView) y `mentorias.tsx` (placeholder Calendly). Entitlements en `User`. Mentoría live **pendiente**. No hay IAP nativo. Staff carga videos en **web**.

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
  (portal)/(tabs)/        # cliente: index, datos, documentos, tablero, cuenta, cursos, mentorias
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
- Flujo: login → 2FA **si la cuenta ya lo tiene** → `must_change_password` → portal o staff
- `CLIENT` → `/(portal)/(tabs)`; resto → `/(staff)/(tabs)/dashboard`
- **No** forzar setup de Authenticator en `CLIENT` (App Store 4.2.3(i)). Backend/web sí pueden exigirlo excepto `appreview@epoint.com`.

## Features

| Área | Notas |
|------|--------|
| Portal | datos (SSN), documentos, tablero kanban, cuenta + avatar. En `feature/cursos-mentorias`: tabs Cursos/Mentorías por entitlement |
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
