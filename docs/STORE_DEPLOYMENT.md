# Despliegue en stores — EPoint Credit (mobile)

**Qué tiene cada versión, hilo de Apple y checklist Play:** [`VERSIONS.md`](./VERSIONS.md). Este archivo es la operativa (EAS, comandos, secrets).

App Expo (`com.epoint.crm`) · proyecto EAS `@alexisguanique/epoint-crm-mobile`  
Perfil de build store: `production` en [`eas.json`](../eas.json)

| Perfil EAS | API embebida |
|------------|----------------|
| `preview` | Dev Heroku: `https://dev-epoint-crm-backend-3807e7e86dca.herokuapp.com/api/v1` |
| `production` | Prod Heroku: `https://epoint-crm-backend-7d70ac333373.herokuapp.com/api/v1` |

El `.env` local no afecta builds de store.

---

## App Store (iOS) — estado ago 2026

Binario en revisión: **1.0.0 (13)**. Rama de store: `release/1.0.0`. **No** reenviar `feature/cursos-mentorias`.

### Completado
- [x] Bundle ID `com.epoint.crm` · Team Apple EPoint Corporation `F75PF6CU83`
- [x] App Store Connect: **EPoint Credit** (Apple ID `6796205273`, SKU `epoint-crm-ios-001`)
- [x] EAS `@alexisguanique/epoint-crm-mobile` · API Key ASC `8UGGW5V239`
- [x] iPhone only: `ios.supportsTablet: false` (build 11 falló 2.1(a) en iPad)
- [x] CLIENT sin modal de Authenticator (build 13; Guideline 4.2.3(i))
- [x] Demo: `appreview@epoint.com` / `AppReview123!` — backend saltea 2FA y must_change_password
- [x] Metadata, App Privacy, Age 4+, Finance/Business, support `https://epointsolution.com/`

### Builds (no reusar los viejos)
| Build | Qué pasó |
|-------|----------|
| 10 | API **dev** + icono Expo. Obsoleto. |
| 11 | API prod + logo. Rechazo **2.1(a)** iPad. |
| 12 | iPhone only. Rechazo **4.2.3(i)** TOTP. |
| **13** | iPhone only + sin Authenticator en CLIENT. En review. Luego preguntaron préstamos (no) y **3.1.1 IAP cursos**. Reply: portal only, no IAP; **mismo build 13**. |

### Notes vigentes (no poner otras cuentas)
```
EPoint Credit — iOS 1.0.0 (build 13)
iPhone only. Please review on iPhone, not iPad.
Client portal only. Production API.

APP REVIEW LOGIN (no 2FA, no extra apps):
Username: appreview@epoint.com
Password: AppReview123!
No 2FA. No forced password change. No authenticator app required.
```

**Prohibido en Notes:** `guaniquediaz@gmail.com` u otras cuentas con TOTP.

### No meter en el IPA 1.0
Tabs/player de cursos, copy de “buy course”, IAP. Eso vive en `feature/cursos-mentorias` para 2.0 / web.

### Notas iOS
- Push APNs: pendiente (login Apple ID del titular).
- Credenciales ASC locales: `secrets/AuthKey_8UGGW5V239.p8` (gitignored).
- Script demo CLIENT: `backend/scripts/create_app_review_client.py` (repo backend).

### Comandos iOS (referencia)
```bash
export EXPO_ASC_API_KEY_PATH="./secrets/AuthKey_8UGGW5V239.p8"
export EXPO_ASC_API_KEY_ID="8UGGW5V239"
export EXPO_ASC_API_KEY_ISSUER_ID="2c34a2f1-f5e8-490d-85ad-bddc55980867"

npx eas build --profile production --platform ios
npx eas submit --profile production --platform ios --latest
```

---

## Google Play (Android) — pendiente (sin cuenta aún)

### Bloqueador actual
- [ ] Cuenta **Google Play Console** (titular / invitación de Eberths)
- [ ] Rol mínimo: Admin o Release manager para Alexis

### Ya preparado en el repo
- [x] Package `com.epoint.crm`
- [x] Perfil `production` → AAB (`buildType: app-bundle`) + API prod
- [x] Keystore Android remoto en EAS (credenciales creadas)
- [x] Scripts `build:prod:android` / `submit:android`
- [x] Logo `assets/epoint-logo.png` corregido (era JPEG con extensión `.png`; rompía AAPT/Gradle)
- [x] `usesCleartextTraffic: false`, permisos sin `RECORD_AUDIO`
- [x] Textos / checklist de ficha (abajo y en README)

### Build Android
- [ ] Build AAB production exitoso en EAS  
  - Intento previo falló por el PNG inválido; **reintentar** tras el fix del logo:
  ```bash
  npm run build:prod:android
  ```
- [ ] Descargar AAB desde expo.dev o usar `eas submit` cuando haya service account

### Play Console (cuando exista la cuenta)
1. [ ] Crear app **EPoint Credit** (gratis)
2. [ ] Privacy policy: `https://epointsolution.com/`
3. [ ] Store listing (short + full description EN)
4. [ ] Icon 512×512, feature graphic 1024×500, screenshots phone (≥2)
5. [ ] Content rating (IARC) · Target audience **18+** · Data safety (mismo criterio que App Privacy iOS)
6. [ ] App access restringido + demo en **prod**
7. [ ] Subir AAB a **Internal testing** primero
8. [ ] Promover a producción cuando Google lo permita (cuentas nuevas a veces exigen closed testing)
9. [ ] (Opcional) Service account JSON → `play-service-account.json` (gitignored) + config en `eas.json` submit android

### Textos listos para pegar

**Short description (≤80):**
```
Secure credit onboarding: profile, documents, and status tracking.
```

**Full description:** reutilizar la de App Store Connect (EPoint Credit).

**Data safety (resumen):** email, name, phone, address, credit info, sensitive info (SSN), photos/docs, user ID — linked to user, not for ads/tracking, purpose app functionality.

### Pedido al titular (Eberths) — Play
1. Abrir / pagar [Google Play Console](https://play.google.com/console) (~USD 25 una vez).
2. Invitar a Alexis como **Admin** o **Release manager**.
3. (Opcional) Crear service account con acceso a Google Play Android Developer API y compartir el JSON.

### Comandos Android (cuando toque)
```bash
npm run build:prod:android
# Manual: subir AAB desde la página del build en expo.dev
# O con service account:
# npm run submit:android
```

---

## Identificadores

| Campo | Valor |
|-------|--------|
| iOS bundle / Android package | `com.epoint.crm` |
| Expo project ID | `19401c1b-8557-4fb4-8079-8bc5cf916b00` |
| App Store Connect app ID | `6796205273` |
| Apple Team ID | `F75PF6CU83` |
| Nombre en stores | EPoint Credit |
| Privacy / Support URL | `https://epointsolution.com/` |

---

## Orden sugerido al retomar desde otra máquina

1. `git clone` / `git pull` en `epoint-mobile-central`. Para cursos: `git checkout feature/cursos-mentorias`. Para store: `release/1.0.0`.
2. Confirmar estado iOS en App Store Connect (build **13**). No submitear la rama de cursos como 1.0.
3. Cuando haya Play Console: `npm run build:prod:android` → Internal testing → listing completo.
4. Nuevo IPA store solo si Apple pide otro binario — y **sin** UI de cursos.
