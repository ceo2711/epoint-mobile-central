# Despliegue en stores — EPoint Credit (mobile)

App Expo (`com.epoint.crm`) · proyecto EAS `@alexisguanique/epoint-crm-mobile`  
Perfil de build store: `production` en [`eas.json`](../eas.json)

| Perfil EAS | API embebida |
|------------|----------------|
| `preview` | Dev Heroku: `https://dev-epoint-crm-backend-3807e7e86dca.herokuapp.com/api/v1` |
| `production` | Prod Heroku: `https://epoint-crm-backend-7d70ac333373.herokuapp.com/api/v1` |

El `.env` local no afecta builds de store.

---

## App Store (iOS) — hecho

### Completado
- [x] Bundle ID `com.epoint.crm` registrado en el team Apple (EPoint Corporation, Team ID `F75PF6CU83`)
- [x] App creada en App Store Connect: **EPoint Credit** (Apple ID `6796205273`, SKU `epoint-crm-ios-001`)
- [x] Acceso App Manager/Admin vía invitación de Eberths Perozo
- [x] App Store Connect API Key (`8UGGW5V239`) para build/submit sin Apple ID personal
- [x] Distribution Certificate + Provisioning Profile generados con EAS
- [x] Config store: splash, `ITSAppUsesNonExemptEncryption: false`, sin cleartext HTTP, scripts `build:prod:*` / `submit:ios`
- [x] Build production iOS `1.0.0` (buildNumber **10**) subido a App Store Connect
- [x] Metadata: screenshots iPhone + iPad 13", description EN, keywords, support URL `https://epointsolution.com/`
- [x] App Privacy publicado (datos vinculados, sin tracking)
- [x] Age rating **4+**, categoría Finance / Business
- [x] Precio/disponibilidad configurados
- [x] Review notes + demo: `asesor@epoint.com` / `Asesor123!` (ambiente **dev** en el binario enviado)
- [x] Envío a revisión (estado al momento del envío: **Pending Review**)

### Notas iOS
- El binario **1.0.0 (10)** en review se construyó con API **dev** y el **icono placeholder de Expo**.
- En repo (`release/1.0.0` desde `27e2654`) el icono/splash ya usan el logo ePoint; el perfil `production` apunta a API **prod**.
- **Próximo paso:** nuevo build iOS production + submit (buildNumber auto-increment, p.ej. 11) para que Apple muestre el logo correcto.
- Push APNs: pendiente (requiere login Apple ID del titular; se omitió para no bloquear el submit).
- Reglamento de Servicios Digitales (UE): lo completa el Account Holder (Eberths) si hace falta.
- Credenciales ASC locales: `secrets/AuthKey_8UGGW5V239.p8` (gitignored) + `eas.json` submit.production.ios.

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

1. `git pull` en `epoint-central-mobile` (rama `release/1.0.0`).
2. Confirmar estado iOS en App Store Connect (aprobada / en review / rechazo).
3. Cuando haya Play Console: `npm run build:prod:android` → Internal testing → listing completo.
4. Si iOS sigue en dev y ya quieren prod: nuevo build iOS + versión `1.0.1` (el `eas.json` production ya tiene URL prod).
