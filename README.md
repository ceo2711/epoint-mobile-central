# Epoint CRM — App móvil (Expo)

App React Native con **Expo Router** que consume el mismo backend local que el frontend web (`/api/v1`).

> **SDK 54** — compatible con Expo Go del App Store. (SDK 55–57 aún no están disponibles en Expo Go de iOS.)

## Requisitos

- Node 20+
- Backend local corriendo en el puerto `8000` (ver `backend/`)
- Expo Go actualizado desde el App Store **o** emulador Android / simulador iOS

## Setup

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

Escaneá el QR con Expo Go, o usá los scripts de abajo.

### Android emulator (importante)

**No apretés `a`** si Metro está en modo LAN (`--lan` / QR del iPhone).
Expo abre `exp://192.168.x.x:8081` y **Expo Go se cuelga** en el emulador.

Usá siempre el bridge local:

```bash
# Opción A — Metro + Android en localhost
npm run android

# Opción B — ya tenés Metro (p.ej. para iPhone en LAN)
# Emulador encendido → abre Expo Go bien (adb reverse + 127.0.0.1)
npm run android:open
```

Si Expo Go ya quedó colgado: `npm run android:open` lo fuerza a cerrar y reabrir.

### iPhone físico (misma Wi‑Fi)

```bash
npx expo start --lan
# o: npm run start:lan
```

Escaneá el QR (`exp://192.168.x.x:8081`).


## Variable de entorno

| Variable | Descripción |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL de la API, incluyendo `/api/v1` |

### Host según entorno

| Entorno | URL típica |
|---|---|
| iOS simulador | `http://localhost:8000/api/v1` |
| Android emulador | `http://10.0.2.2:8000/api/v1` |
| Celular físico | `http://<IP-LAN-del-PC>:8000/api/v1` |

Si no definís `EXPO_PUBLIC_API_URL`, la app usa `localhost` en iOS/web y `10.0.2.2` en Android.

### Backend en dispositivo físico

1. Averiguá la IP LAN del PC (`ipconfig` / `ifconfig`) — la misma que aparece en `exp://IP:8081`.
2. En `mobile/.env`: `EXPO_PUBLIC_API_URL=http://<IP-LAN>:8000/api/v1`
3. Levantá el backend escuchando en **toda la red** (no solo localhost):
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
4. Reiniciá Expo con caché limpia (`npx expo start -c`) para que tome el `.env`.
5. Celular y PC en la misma Wi‑Fi.

Si el celular **no** está en la misma Wi‑Fi, apuntá a la API de Heroku:
`EXPO_PUBLIC_API_URL=https://dev-epoint-crm-backend-3807e7e86dca.herokuapp.com/api/v1`

> Nota: en apps nativas **no aplica CORS** (es solo del navegador). Si probás la app en web (`expo start --web`), el backend debe aceptar el origen de Expo.

## Auth

- Login + 2FA + cambio obligatorio de contraseña
- Tokens en **SecureStore** (access + refresh) con refresh automático en 401
- Rol `CLIENT` → tabs del portal; resto → tabs staff

## Pantallas incluidas

**Auth:** login, 2FA, cambio obligatorio de contraseña.

**Portal cliente:** inicio, datos (SSN/dirección/vehículo), documentos (upload + verificación), tablero kanban, cuenta.

**Staff (según rol/permiso):**
- Panel / métricas
- Clientes (lista + detalle con aprobar/rechazar, docs, tablero, reasignar asesor)
- Prospectos (lista + detalle)
- Calendario Calendly, Contratos DocuSign, Pagos
- Usuarios, Comercios, Roles
- Mi cuenta (perfil, comercio activo, contraseña)

## Push notifications (app cerrada)

La **campana** (in-app + SSE) funciona en Expo Go.  
Los **popups del sistema con la app cerrada** requieren **push remoto** y **no funcionan en Expo Go** (SDK 53+).

1. Proyecto EAS ya linkeado (`extra.eas.projectId` en `app.json`).
2. Build de desarrollo en **dispositivo físico**:
   ```bash
   npm run build:dev:ios
   # o
   npm run build:dev:android
   ```
3. Instalá el build, abrí la app, iniciá sesión y aceptá permisos de notificaciones.
4. En Metro usá el dev client:
   ```bash
   npm run start:dev-client
   ```
5. Backend con `NOTIFICATIONS_DRY_RUN=false` y eventos con canal `PUSH` (p.ej. comentario con `@`).

Android: en el primer `eas build` configurá credenciales FCM en [expo.dev](https://expo.dev) si te lo pide.  
iOS: cuenta Apple Developer + push credentials (EAS te guía).

Roles soportados en nav: `ADMIN`, `BRANCH_MANAGER`, `SALES_REP`, `SUB_SELLER`, `ADVISOR`, `AREA_LEADER`, `CLIENT`.

## Estructura

```
mobile/
  app/                 # Expo Router
    (auth)/            # login, 2FA, cambiar contraseña
    (staff)/(tabs)/    # CRM staff
    (portal)/(tabs)/   # portal cliente
  src/
    theme/
    lib/
    features/auth/
    components/
```

## Store builds (App Store / Google Play)

Registro de versiones (1.0 / 2.0 / cursos, revisiones Apple, qué falta en Play): [`docs/VERSIONS.md`](docs/VERSIONS.md).  
Comandos EAS y secrets: [`docs/STORE_DEPLOYMENT.md`](docs/STORE_DEPLOYMENT.md).

Los perfiles EAS embeben la API según el entorno:

| Perfil | API |
|--------|-----|
| `preview` | `https://dev-epoint-crm-backend-3807e7e86dca.herokuapp.com/api/v1` (dev) |
| `production` | `https://epoint-crm-backend-7d70ac333373.herokuapp.com/api/v1` (prod) |

El `.env` local **no** se usa en esos builds; sigue sirviendo solo para Expo Go / desarrollo diario.

### Comandos

```bash
# Preview interno (APK Android / IPA ad-hoc)
npm run build:preview:ios
npm run build:preview:android
npm run build:preview:all

# Production (AAB para Play + IPA para App Store)
npm run build:prod:ios
npm run build:prod:android
npm run build:prod:all

# Enviar el último build production a las stores
npm run submit:ios
npm run submit:android
```

### Checklist antes del primer submit

1. `npx eas whoami` — sesión Expo correcta (proyecto `epoint-crm-mobile`, owner `alexisguanique`).
2. **Apple Developer** + app en App Store Connect con bundle `com.epoint.crm` (EAS gestiona certificados).
3. **Google Play Console** + app con package `com.epoint.crm`; credenciales de servicio en EAS para submit.
4. **Privacy Policy URL** pública (obligatoria en ambas stores).
5. Screenshots, descripción, categoría y age rating en cada consola.
6. Push remoto (opcional pero recomendado): FCM (Android) y APNs (iOS) en [expo.dev](https://expo.dev).

> `production` usa `autoIncrement` remoto para `buildNumber` / `versionCode`. La versión de marketing (`version` en `app.json`) se sube a mano cuando corresponda (p.ej. `1.0.1`).

### Google Play (preparación)

**Package:** `com.epoint.crm` · **AAB** vía `npm run build:prod:android`

#### Pedirle al titular de la cuenta (Eberths)

1. Crear / pagar [Google Play Console](https://play.google.com/console) (USD 25 una vez), o invitarte como **Admin** / **Release manager**.
2. Crear app **EPoint Credit**, gratis, package lo define el AAB (`com.epoint.crm`).
3. (Opcional para `eas submit`) Service account JSON con acceso a Play Developer API — guardarlo como `play-service-account.json` (gitignored).

#### Textos de ficha (EN, listos para pegar)

**Short description (≤80):**
```
Secure credit onboarding: profile, documents, and status tracking.
```

**Full description:** misma description larga de App Store Connect (EPoint Credit).

**Privacy policy:** `https://epointsolution.com/`

**Category:** Finance · **Target audience:** 18+

**App access (restricted):** demo account en prod (crear cuando toque) — mientras tanto documentar en Play Console.

**Data safety:** email, name, phone, address, credit info, sensitive info (SSN), photos/docs, user ID — linked to user, not for advertising/tracking; purpose app functionality.

**Tracks:** primero **Internal testing** con el AAB; producción cuando Google lo permita (cuentas nuevas a veces exigen closed testing).

Sin cuenta de Play aún: se puede generar y guardar el AAB en Expo; la subida espera la consola.

## Scripts

```bash
npm start                 # Expo DevTools
npm run android
npm run ios
npm run lint              # tsc --noEmit
npm run build:preview:*   # builds internos con API Heroku
npm run build:prod:*      # builds store (AAB / IPA)
npm run submit:ios|android
```
