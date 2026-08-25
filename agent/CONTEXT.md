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

**Nunca** enviar `feature/cursos-mentorias` a App Store como versión 1.0: Apple ya rechazó **3.1.1 IAP** porque el binario mencionaba courses.

## App Store (ago 2026) — leer antes de tocar iOS

- App Store Connect: **EPoint Credit**, Apple ID `6796205273`, bundle `com.epoint.crm`, Team `F75PF6CU83`.
- EAS: `@alexisguanique/epoint-crm-mobile` · Expo project `19401c1b-8557-4fb4-8079-8bc5cf916b00`.
- Demo review: `appreview@epoint.com` / `AppReview123!`. **No** poner `guaniquediaz@gmail.com` (tiene 2FA) en Notes.
- Binario en review: **1.0.0 build 13**. No generar otro IPA 1.0 salvo rechazo nuevo.
- `ios.supportsTablet` debe ser **`false`** (iPhone only). Build 11 falló Guideline **2.1(a)** porque Apple revisó en iPad.
- En este repo (rama cursos): el modal `MandatoryTwoFactorModal` **no** se muestra a `CLIENT` (Guideline **4.2.3(i)**). Staff sí. En **web/backend** el 2FA de clientes reales sigue; solo `appreview@…` está exceptuado.
- Historial de rechazos reales:
  - 14 ago — 2.1 info incompleta
  - 18 ago — 2.1(a) iPad (`supportsTablet: true`)
  - 20 ago — 4.2.3(i) TOTP / Authenticator
  - 22 ago — 2.1 ¿préstamos? (no: es onboarding de crédito, no lending)
  - 24 ago — **3.1.1 IAP cursos** → reply: portal only, no se vende nada en la app; mismo build 13 + Actualizar revisión
- Reply vigente: no IAP, no subscriptions, no self-registration; el portal es datos/docs/tablero. Cursos se venden en la **landing + CRM web**, no en este IPA.
- Detalle operativo: `docs/STORE_DEPLOYMENT.md`.

## Estado cursos en esta rama

Tabs portal `cursos.tsx` / `mentorias.tsx` + entitlements en `User`. Es UI de **2.0**. Mentoría Calendly pendiente. No hay IAP nativo.

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
