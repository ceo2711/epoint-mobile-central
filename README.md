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

Escaneá el QR con Expo Go, o presioná `a` / `i` para emulador.

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
- Notificaciones
- Mi cuenta (perfil, comercio activo, contraseña)

Roles soportados en nav: `ADMIN`, `SALES_REP`, `ONBOARDING_MANAGER`, `ADVISOR`, `CLIENT`.

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

## Scripts

```bash
npm start          # Expo DevTools
npm run android
npm run ios
npm run lint       # tsc --noEmit
```
