# Registro de versiones — EPoint Credit (mobile)

Fuente de verdad para **qué tiene cada versión**, **qué se mandó a Apple**, **qué falta en Google Play** y **qué se está agregando ahora**. Si cambiás un binario de store o el alcance de una rama, actualizá este archivo en el mismo commit.

Operativa de EAS / comandos: [`STORE_DEPLOYMENT.md`](./STORE_DEPLOYMENT.md).  
**Toma y dame con Apple (mensajes, replies, próximo texto):** [`APP_REVIEW.md`](./APP_REVIEW.md).

---

## Cómo se numeran las cosas (no confundir)

| Cosa | Qué es | Valor actual |
|------|--------|----------------|
| Versión de marketing | `expo.version` en `app.json` (la que ve Apple/Play) | **1.0.0** en todas las ramas |
| Build iOS | `buildNumber` remoto EAS (`autoIncrement`) | Último enviado: **13** |
| VersionCode Android | remoto EAS | **no hay AAB de store todavía** |
| Rama git `release/1.0.0` | Código **store 1.0** (portal cliente) | HEAD `cd0c4e9` |
| Rama git `release/2.0.0` | Ciclo 2: vuelve staff/admin. **No es un IPA 2.0 en la store** | HEAD `aa27bf1` |
| Rama git `feature/cursos-mentorias` | Cursos + mentorías + fixes App Store (iPhone only, sin Authenticator en CLIENT) | HEAD de trabajo |

`app.json` sigue en `1.0.0` aunque la rama se llame `release/2.0.0`. Subir la marketing version (p.ej. a `2.0.0`) es un paso **explícito** el día que se arme un IPA nuevo para la store.

EAS embebe la API según perfil:

| Perfil | API |
|--------|-----|
| `preview` | Dev: `https://dev-epoint-crm-backend-3807e7e86dca.herokuapp.com/api/v1` |
| `production` | Prod: `https://epoint-crm-backend-7d70ac333373.herokuapp.com/api/v1` |

El `.env` local **no** entra en esos builds.

---

## Mapa rápido

| Store / producto | Rama git | Binario | Apple | Google Play |
|------------------|----------|---------|-------|-------------|
| **1.0.0 portal cliente** | `release/1.0.0` | iOS **1.0.0 (13)** | 26 ago: insistieron **3.1.1**. Ver [`APP_REVIEW.md`](./APP_REVIEW.md) | **No empezó** (sin Play Console) |
| Ciclo 2 staff/admin | `release/2.0.0` | Ninguno de store | No enviar | No enviar |
| Cursos / mentorías | `feature/cursos-mentorias` | Ninguno de store | **Prohibido** como 1.0 (Apple 3.1.1) | Igual: no mandar player de cursos en el primer AAB |

---

## 1.0.0 — App Store (portal cliente)

**Nombre en stores:** EPoint Credit  
**Bundle / package:** `com.epoint.crm`  
**App Store Connect:** Apple ID `6796205273`, SKU `epoint-crm-ios-001`  
**Team:** EPoint Corporation `F75PF6CU83`  
**EAS:** `@alexisguanique/epoint-crm-mobile` · project `19401c1b-8557-4fb4-8079-8bc5cf916b00`  
**SDK:** Expo 54 · RN 0.81 · iPhone only en el IPA 13 (`supportsTablet: false`)  
**API del binario 13:** producción Heroku.

### Qué incluye (alcance de producto)

App **solo portal de cliente**. No hay registro público. El asesor da de alta al cliente en el CRM; el cliente entra con email + contraseña.

- Login (email/password). Si la cuenta **ya** tiene TOTP, pide el código. **No** obliga a instalar Authenticator a un `CLIENT` (Guideline 4.2.3(i)).
- Cuenta App Review: `appreview@epoint.com` / `AppReview123!` — backend/frontend saltean 2FA y `must_change_password`.
- Home del portal.
- Datos (perfil, SSN, dirección, vehículo). Validación de direcciones.
- Documentos: cámara / galería / archivos, verificación IA, alternativas de docs.
- Tablero kanban (puede estar bloqueado hasta datos/docs verificados — esperado en demo).
- Cuenta: perfil, avatar, idioma del dispositivo (es/en, sin switcher).
- Chat flotante solo `CLIENT`.
- Campana de notificaciones (SSE). Push remoto APNs **pendiente** (cuenta del titular).
- Eliminación de cuenta: Apple la pidió en 2.1 info; documentada en Notes como requerida por Guideline 5.1.1(v) (flujo en Cuenta si está en el binario).

**No es un banco ni un lender.** No hay “solicitar préstamo”. Es onboarding / seguimiento de asesoría de crédito.

### Qué NO incluye (y no debe entrar en un IPA 1.0)

- Staff / admin / vendedores (se recortó a propósito: commit `31e8e5d`).
- Tabs **Cursos** / **Mentorías**, player de video, catálogo 12×36.
- Compras in-app, suscripciones, Stripe, payment links dentro de la app.
- Contenido educativo de pago (Apple 3.1.1).
- Autoregistro.
- Layout iPad (`supportsTablet` debe ser `false`).
- Forzar Google/Microsoft Authenticator a clientes.

### Builds iOS de la 1.0.0

| Build | Fecha aprox. | Qué tenía | Resultado |
|-------|--------------|-----------|-----------|
| **10** | ~31 jul / 10 ago | API **dev**, icono placeholder Expo | Obsoleto. No reusar. |
| **11** | 10 ago | API **prod**, logo ePoint, `supportsTablet: true` | Rechazo **2.1(a)** 18 ago: crash/freeze en iPad Air 11" (M3). |
| **12** | 18 ago | iPhone only | Rechazo **4.2.3(i)** 20 ago: modal 2FA obligaba Authenticator. Revisaron iPhone 17 Pro Max **y** iPad. |
| **13** | 20 ago | iPhone only + `CLIENT` sin modal Authenticator | Binario vigente. Pregunta préstamos 22 ago. Rechazo **3.1.1 IAP** 24 ago (cursos fuera de la app). Reply + **mismo 13**. |

EAS de referencia (cuando existan en expo.dev): no reenviar 10–12.

### Hueco git vs IPA 13 (crítico)

El IPA **13** se compiló con cambios **locales** que **no están** en `release/1.0.0`:

| Cambio del IPA 13 | `release/1.0.0` en git | `feature/cursos-mentorias` |
|-------------------|------------------------|----------------------------|
| `ios.supportsTablet: false` | sigue `true` | `false` |
| No mostrar `MandatoryTwoFactorModal` a `CLIENT` | el modal **sí** bloquea a CLIENT | skip CLIENT |

Si Apple pide **otro IPA 1.0**: cherry-pick **solo** tablet + skip 2FA CLIENT sobre `release/1.0.0`. **No** usar `feature/cursos-mentorias` (tiene player de cursos → 3.1.1).

### Revisiones Apple (hilo real)

Los “Rechazado por el desarrollador” / Removed no cuentan: los cancelamos nosotros.

#### 0. 31 jul — primer envío

Procesando / luego sacado. Build viejo (dev + icono Expo). No es el 13.

#### 1. 14 ago — Guideline **2.1 Information Needed** (no era un crash)

App nueva. Pedían:

- Screen recording en dispositivo físico, OS actual, desde el launch.
- Login, (si hay) registro y **account deletion**.
- Datos en App Review Information.
- Entender qué hace la app.

Respuesta: Notes + demo `appreview@epoint.com` / `AppReview123!` + video en iPhone. **No** usar `guaniquediaz@gmail.com` (tiene 2FA; Apple la llegó a usar).

#### 2. 18 ago — Guideline **2.1(a) App Completeness** — build **11**

Dispositivo: **iPad Air 11" (M3), iPadOS 26.6**. No pasaron de splash/login. El video era iPhone; `supportsTablet: true` hacía que Apple la tratara como iPhone+iPad.

Fix: `supportsTablet: false` → build **12**. Reply: *This app is iPhone only. Review on iPhone.* Borrar screenshots de iPad en la ficha.

#### 3. 20 ago — Guideline **4.2.3(i) Design / Minimum Functionality** — build **12**

Tras el login, modal bloqueante de TOTP (`otpauth://` → Authenticator). Apple: el usuario tiene que entrar **sin instalar otra app**.

Fix: no mostrar el modal a `CLIENT`. Staff sigue obligado en ese binario. Backend: solo `appreview@epoint.com` saltea TOTP/`must_change_password` en API (clientes reales en **web** siguen con 2FA). Build **13**.

#### 4. 22 ago — Guideline **2.1 Information Needed** — build **13**

Ya revisaron el 13. Pregunta: **“Can users request loan?”**  
No es un bug. Con el nombre EPoint Credit sospechan lending.

Reply: no. Portal de onboarding (datos, documentos, tablero). Educación/asesoría, no originación de préstamos. **Sin IPA nuevo.** Actualizar revisión con el **mismo 13**.

#### 5. 24 ago — Guideline **3.1.1 Business — Payments — In-App Purchase** — build **13**

Dispositivo otra vez **iPad Air 11"**. Texto de Apple: la app accede a contenido digital pago (cursos) comprado **fuera** de la app, y ese contenido no se vende con IAP.

El 13 **no** tiene tabs de cursos (el código de cursos es del 25 ago, en `feature/cursos-mentorias`). **No** se mandó esa rama. **No implementar IAP** para publicar el 1.0.

#### 6. 26 ago — **mismo** 3.1.1, **mismo** build **13**, **mismo** Submission ID `d13dde36-…`

No es un IPA nuevo ni cursos colados. Apple insiste porque Support/Privacy de la ficha apuntan a **`https://epointsolution.com/`**, cuya home vende education platform, módulos y mentorship. Review entra ahí y aplica 3.1.1 aunque el binario sea solo portal.

**Qué hacer:** cambiar Support URL y Privacy Policy URL a una página que **solo** describa el portal de crédito. No usar epointsolution.com ni epointcredits.com. Reply: servicio profesional persona a persona (3.1.3(e)); este binario no desbloquea cursos. Mismo **13** + Actualizar revisión **después** de cambiar las URLs.

**Regla:** mientras 1.0 no esté Approved, no meter player/venta de cursos en el IPA ni linkear sitios que vendan cursos.

### Demo y Notes (copiar tal cual)

```
EPoint Credit — iOS 1.0.0 (build 13)
iPhone only. Please review on iPhone, not iPad.
Client portal only. Production API.

APP REVIEW LOGIN (no 2FA, no extra apps):
Username: appreview@epoint.com
Password: AppReview123!
No 2FA. No forced password change. No authenticator app required.

HOW TO REVIEW:
1. Sign in with appreview@epoint.com / AppReview123!
2. Client portal: Home, Datos, Documentos, Tablero, Cuenta.
3. Tablero may be locked until required data/docs are complete (expected for a new demo client).

Do not use other accounts. Staff/advisor/admin are not for this review.
No public self-registration. No IAP/subscriptions. No ads/tracking.
Account deletion is required by Guideline 5.1.1(v) and is in Cuenta.
This app does not originate or request loans.
```

**Prohibido en Notes:** `guaniquediaz@gmail.com` u otras cuentas con TOTP.

### Metadata store 1.0 (ya cargada)

- Categoría Finance / Business · Age **4+**
- App Privacy publicado (datos vinculados, sin tracking)
- Support / Privacy: **hay que cambiarlas**. `https://epointsolution.com/` es la home de programas educativos y disparó 3.1.1 (26 ago).
- Screenshots iPhone. **Sin** capturas iPad.
- Precio: gratis. Sin IAP en la ficha.

### Pendiente iOS (después de Approved)

- [ ] Push APNs (login Apple ID del Account Holder / Eberths)
- [ ] Reglamento de Servicios Digitales (UE) si Apple lo pide al titular
- [ ] No promocionar cursos **dentro** de este IPA hasta una versión nueva con estrategia IAP o sin contenido educativo

---

## 2.0.0 — Ciclo 2 (solo git, no está en la store)

Rama: `release/2.0.0`. Marketing version en `app.json` **sigue 1.0.0**.

### Qué suma respecto al recorte store 1.0

Vuelve el **CRM staff** en el mismo binario (no mandar esto a review 1.0):

- Roles: `ADMIN`, `BRANCH_MANAGER`, `SALES_REP`, `SUB_SELLER`, `ADVISOR`, `AREA_LEADER` (+ `CLIENT`).
- Panel / métricas.
- Clientes (lista, detalle, docs, tablero, reasignar asesor, alcance por sede).
- Prospectos y pipeline de ventas (líder de área VENTAS, vendedor, subvendedor).
- Calendario Calendly, contratos DocuSign, pagos.
- Usuarios, comercios, sedes, fuentes, roles (admin).
- Gate por sede, calendario interactivo.
- Paridad onboarding/asesor con web; menciones `@` en cards del tablero.
- `X-Merchant-Id` multi-comercio.

Portal cliente (mismo que 1.0, **sin** cursos todavía en esta rama): Home, Datos, Documentos, Tablero, Cuenta.

### Qué NO tiene aún (eso está en la feature)

- Entitlements `credit` / `course` / `mentorship`.
- Tabs Cursos / Mentorías.
- Player de lecciones.

No hay IPA/AAB de “2.0.0” en ninguna store.

---

## Próxima — cursos y mentorías (`feature/cursos-mentorias`)

Trabajo **en curso** (ago 2026). Destino de store: una versión **nueva** (p.ej. marketing `2.0.0` o `1.1.0`), **nunca** el IPA 1.0.0 (13).

Repos hermanos en la misma rama: backend, frontend, landing `epoint-credits`.

### Producto (los 4 repos)

Un `Client` + user `CLIENT` puede tener productos **combinables**:

| Código | Qué desbloquea | Cómo se compra |
|--------|----------------|----------------|
| `CREDIT` | Asesoría: datos, docs, tablero | Vendedor: prospecto → DocuSign → pago. Merge si el email ya existía. |
| `COURSE` | Player 12 módulos / 36 lecciones | Landing `/curso` → checkout público CRM → `/pagar/{token}` |
| `MENTORSHIP` | Mentoría 1:1 | Landing `/servicios` → mismo checkout. Calendly en portal **pendiente**. |

`ClientStatus` es solo el pipeline de asesoría. Sin `CREDIT` no hay onboarding. Status `SIN_ASESORIA` = solo educativo.

Alta landing: `POST /api/v1/public/checkout` (sin JWT), merchant `epoint-credits`, source `LANDING`, actor `system@epoint.com`. Educación **no** pasa por `try_auto_convert`. Bienvenida por mail si es alta nueva.

### Qué ya hay en **esta app mobile** (esta rama)

- `User.entitlements: { credit, course, mentorship }` desde `/auth/me`.
- Tabs portal **Cursos** y **Mentorías** (`app/(portal)/(tabs)/cursos.tsx`, `mentorias.tsx`).
- Cursos: lista módulos/lecciones, play URL firmada, WebView video, marcar completa. Lock copy si no hay entitlement `course`.
- Mentorías: pantalla placeholder (`portal.mentorshipSoon`) o lock si no hay `mentorship`.
- Fixes de review que el IPA 13 ya tenía: iPhone only + no Authenticator en CLIENT.
- Docs de agente + este registro.

### Qué falta (mobile y producto)

- [ ] Mentoría: agendar Calendly en la tab (hoy solo texto).
- [ ] Gates de nav por entitlement (hoy las tabs se listan siempre; el lock es dentro de la pantalla). Alinear con web `PortalProductGate` si se pide.
- [ ] Staff mobile: pantalla para `courses:manage` (upload MP4). Hoy el asesor carga en **web** `/cursos`.
- [ ] i18n: copys de lock/soon ya están; revisar strings staff hardcodeados al tocar esas pantallas.
- [ ] Estrategia store **antes** de mandar este código a Apple:
  - o **no** hay player de cursos en iOS (sigue 3.1.1),
  - o IAP / Reader-app con compras externas según las reglas vigentes de Apple,
  - o el contenido educativo solo en web y la app 2.x sigue siendo portal CREDIT.
- [ ] Subir `expo.version` cuando se arme el IPA de esta línea.
- [ ] Tests de nav si se filtra por entitlement.

### Qué **no** hacer

- No `eas build --profile production` desde esta rama mientras 1.0 esté en review / sin Approved.
- No IAP “porque Apple lo pidió” sin decisión de producto (comisión + backend de receipts).
- No reintroducir `supportsTablet: true` sin UI iPad real.
- No poner cuentas con 2FA en Notes.

---

## Google Play — lo que falta (todo)

**Estado: no hay consola, no hay app, no hay AAB de producción publicado.** Android está preparado en repo; la cuenta la tiene que abrir el titular.

### Bloqueadores (titular Eberths)

1. [ ] Pagar [Google Play Console](https://play.google.com/console) (~USD 25, una vez).
2. [ ] Invitar a Alexis como **Admin** o **Release manager**.
3. [ ] (Opcional) Service account con Play Android Developer API → `play-service-account.json` (gitignored) + `eas.json` submit android.

### Ya está en el repo

- [x] Package `com.epoint.crm`
- [x] Perfil `production` → AAB (`buildType: app-bundle`) + API prod
- [x] Keystore Android remoto en EAS
- [x] Scripts `build:prod:android` / `submit:android`
- [x] Logo `assets/epoint-logo.png` (antes era JPEG con extensión png; rompía AAPT)
- [x] `usesCleartextTraffic: false`
- [x] Permisos: cámara, galería, notificaciones. **Sin** `RECORD_AUDIO`
- [x] Textos de ficha (abajo)

### Build AAB

- [ ] `npm run build:prod:android` **desde `release/1.0.0` + cherry-pick tablet/2FA CLIENT** (mismo alcance que IPA 13). Un intento viejo falló por el PNG; el logo ya está bien.
- [ ] **No** generar el primer AAB desde `feature/cursos-mentorias` (mismo riesgo 3.1.1 / políticas de pagos de Google).
- [ ] Guardar el AAB (expo.dev) hasta tener consola.

### Play Console (cuando exista la cuenta)

1. [ ] Crear app **EPoint Credit**, **gratis**
2. [ ] Privacy policy: `https://epointsolution.com/`
3. [ ] Store listing EN: short + full description (mismos textos que App Store)
4. [ ] Icono 512×512, feature graphic 1024×500, screenshots phone (≥2)
5. [ ] Content rating IARC · audiencia **18+** (ficha Play; iOS es 4+)
6. [ ] Data safety: email, name, phone, address, credit info, SSN, photos/docs, user ID — linked to user, not ads/tracking, purpose app functionality
7. [ ] App access **restringido** + demo prod: `appreview@epoint.com` / `AppReview123!` (sin 2FA)
8. [ ] Declarar que **no** es lending / no se solicitan préstamos
9. [ ] **Internal testing** primero con el AAB
10. [ ] Closed testing si Google lo exige (cuentas nuevas)
11. [ ] Producción cuando lo permitan
12. [ ] FCM / push en expo.dev (Android lo pide en el primer build si no está)
13. [ ] (Opcional) `eas submit` con service account

### Textos listos

**Short description (≤80):**

```
Secure credit onboarding: profile, documents, and status tracking.
```

**Full description:** la larga de App Store Connect (EPoint Credit). Enfatizar portal de onboarding, **no** préstamos, **no** compras in-app en 1.0.

**Category:** Finance  
**Target audience:** 18+

### Pedido corto al titular (WhatsApp)

Abrir Google Play Console (~USD 25), crear la app EPoint Credit (gratis), invitarme Admin o Release manager. Yo subo el AAB a Internal testing. Opcional: JSON de service account para publicar desde EAS.

---

## Identificadores

| Campo | Valor |
|-------|--------|
| iOS bundle / Android package | `com.epoint.crm` |
| Expo slug | `epoint-crm-mobile` |
| Expo owner | `alexisguanique` |
| Expo project ID | `19401c1b-8557-4fb4-8079-8bc5cf916b00` |
| App Store Connect app ID | `6796205273` |
| Apple Team ID | `F75PF6CU83` |
| ASC API Key | `8UGGW5V239` (p8 gitignored en `secrets/`) |
| Issuer ID | `2c34a2f1-f5e8-490d-85ad-bddc55980867` |
| Nombre stores | EPoint Credit |
| Privacy / Support | `https://epointsolution.com/` |
| Demo review | `appreview@epoint.com` / `AppReview123!` |

---

## Cómo actualizar este registro

En el **mismo commit** que:

- un `eas build` / submit de store,
- un rechazo o reply de Apple/Google,
- un recorte o alta de features en una versión de marketing,
- el merge de `feature/cursos-mentorias` a una release,

agregá fila de build, fecha, guideline y “qué tiene / qué no”, y copiá el mensaje de Apple + nuestro reply en [`APP_REVIEW.md`](./APP_REVIEW.md). No dejes el hilo solo en el chat de Cursor.
