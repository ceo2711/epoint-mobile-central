# App Review — EPoint Credit iOS (toma y dame)

Hilo vivo con Apple. Si llegás desde otra PC: leé esto **antes** de responder en App Store Connect.

Registro de versiones / builds: [`VERSIONS.md`](./VERSIONS.md).  
Comandos EAS: [`STORE_DEPLOYMENT.md`](./STORE_DEPLOYMENT.md).

**Última actualización:** 26 ago 2026 (noche, UTC-3).

---

## Estado ahora (leé esto primero)

| Campo | Valor |
|-------|--------|
| App | **EPoint Credit** · Apple ID `6796205273` · bundle `com.epoint.crm` |
| Versión de ficha | **1.0** |
| Binario en review | **1.0.0 (13)** — **no** subir otro IPA |
| Rama git del store | `release/1.0.0` (portal cliente **sin** cursos) |
| Submission ID | `d13dde36-a0cf-4da8-8824-7378f5e0717e` (mismo ticket desde el 20 ago) |
| Último mensaje de Apple | **26 ago 2026, 18:07** — Guideline **3.1.1** otra vez, build **13**, iPad Air 11" (M3) |
| Último reply nuestro | **24 ago 2026, 14:37** (Alexis) — “not a course store…” |
| Pendiente | Reply nuevo (texto abajo) + **Actualizar revisión** con el **mismo 13**. Cambiar Support/Privacy URL. |

**No** mandar `feature/cursos-mentorias`. Ese código es del **25 ago**, el IPA 13 es del **20 ago**. Apple **no** está revisando las tabs de cursos.

Demo: `appreview@epoint.com` / `AppReview123!` — **nunca** `guaniquediaz@gmail.com` en Notes.

---

## Cómo seguir desde otra PC

1. `git pull` en `epoint-mobile-central`, rama `feature/cursos-mentorias` (acá está esta doc). El IPA de store sigue siendo `release/1.0.0`.
2. Abrí [App Store Connect](https://appstoreconnect.apple.com) → EPoint Credit → **App Review**.
3. Confirmá que el build de la versión 1.0 es **13**.
4. **No** digas en el reply que los cursos viven en la web. Eso **es** 3.1.1.
5. Pegá el reply de la sección [Próximo reply (26 ago)](#próximo-reply-listo-para-pegar-26-ago).
6. **Actualizar revisión** / Resubmit. Un Reply sin eso no vuelve a la cola.
7. Ideal **antes** de resubmit: cambiar Privacy Policy URL y Support URL. Hoy apuntan a `https://epointsolution.com/` (home de programas educativos). Apple entra por ese link. Aún no hay página “solo app”; si no se cambia la URL, pueden repetir 3.1.1.

---

## Reglas para hablar con Apple (3.1.1)

### Qué SÍ decir

- Este binario **1.0 (13)** no tiene cursos, videos, catálogo ni compras.
- La app iPhone es un **portal de cliente**: datos, documentos, tablero, cuenta.
- Es un **servicio profesional persona a persona** (asesoría de crédito con un humano), no contenido digital que se desbloquea en el teléfono.
- Este IPA no abre ni desbloquea ningún programa educativo.

### Qué NO decir

- “Los cursos se van a implementar después.”
- “Los clientes los ven en la página web.”
- “La app y la web son el mismo producto; los cursos van en la web.”
- “Paid education is on the website.”

Si lo escribís, Apple lee: contenido digital pago fuera de la app, sin IAP → **3.1.1** otra vez.

No implementar IAP para publicar el 1.0.

---

## Próximo reply (listo para pegar, 26 ago)

```
Hello App Review,

Thank you for the follow-up on Guideline 3.1.1.

This submission is iOS version 1.0, build 13. That binary does not include courses, video lessons, a catalog, subscriptions, or any way to buy or unlock digital content.

EPoint Credit on iPhone is only a client portal for an existing credit-consulting engagement with a human advisor. After login, a client can:

1. Complete personal data
2. Upload required documents
3. Track their case on the board
4. Manage their account

There is no store, no checkout, and no educational section in this app. The app does not link to, embed, or unlock any course or video program.

Payment for credit consulting, when it occurs, is for a person-to-person professional service handled outside the app, not for digital content delivered inside the app.

Please continue review of the same binary: 1.0 (13).

Demo (no 2FA):
Username: appreview@epoint.com
Password: AppReview123!

If a specific screen in this binary appeared to offer a course, please tell us which screen so we can address it. This iOS app does not contain that functionality.

Thank you,
Alexis Guanique
```

Después: **Actualizar revisión**, build **13**.

---

## Cronología del hilo (mensajes reales)

Los “Rechazado por el desarrollador” / Removed los cancelamos nosotros. No cuentan.

### 0. ~31 jul 2026 — primer envío

Build viejo (API **dev**, icono Expo). Procesando / luego sacado. No es el 13.

---

### 1. 14 ago 2026 — Apple: Guideline **2.1 Information Needed**

App nueva. Pedían información, no un crash de código:

- Screen recording en dispositivo físico, OS actual, desde el launch.
- Login, registro (si hay) y **account deletion**.
- Completar App Review Information.
- Entender qué hace la app.

**Nosotros:** Notes + demo `appreview@epoint.com` / `AppReview123!` + video en **iPhone**.  
**Error a no repetir:** no poner `guaniquediaz@gmail.com` (tiene 2FA; Apple la usó).

---

### 2. 18 ago 2026 — Apple: Guideline **2.1(a) App Completeness** — build **11**

Probaron **1.0.0 (11)** en **iPad Air 11" (M3), iPadOS 26.6**. No pasaron de splash/login. El video era iPhone. `supportsTablet: true` → Apple la trata como iPhone **y** iPad.

**Nosotros:** `supportsTablet: false` → build **12**. Reply:

> This app is iPhone only. It is not intended for iPad and should not be reviewed on iPad.  
> Version 1.0.0, Build **12**. Demo: appreview@epoint.com / AppReview123! (no 2FA).  
> Client portal only. No public registration, no IAP, no subscriptions.

También: quitar screenshots de iPad en la ficha. Reenviar a review.

---

### 3. 20 ago 2026 — Apple: Guideline **4.2.3(i)** — build **12**

Submission ID (el que sigue vigente): `d13dde36-a0cf-4da8-8824-7378f5e0717e`  
Review date: August 20, 2026  
Devices: iPad Air 11-inch (M3) **and** iPhone 17 Pro Max  
Version reviewed: **1.0 (12)**

**Apple (resumen):** tuvieron que instalar una app autenticadora para entrar. El usuario debe poder usar la cuenta **sin instalar otra app**.

Causa en código: `MandatoryTwoFactorModal` bloqueaba a `CLIENT` y abría `otpauth://`.

**Nosotros:** no mostrar ese modal a `CLIENT`. Staff sigue obligado en ese binario. Backend: solo `appreview@…` saltea TOTP / must_change_password. Build **13**.

Reply de Alexis (20 ago, idea enviada):

> The previous build required setting up TOTP with a third-party authenticator app after login. That is no longer required.  
> New binary: 1.0.0 (13), iPhone only.  
> Username: appreview@epoint.com / Password: AppReview123!  
> No 2FA. No additional app to install.

---

### 4. 22 ago 2026 — Apple: Guideline **2.1 Information Needed** — build **13**

Ya revisaron el **13**. Pregunta: **“Can users request loan?”**  
No pedían IPA nuevo. Con el nombre EPoint Credit sospechan lending.

**Nosotros:** no. No hay flujo de préstamo. Portal de onboarding (datos, documentos, tablero). Educación/asesoría, no originación de préstamos. Mismo **13** + Actualizar revisión.

---

### 5. 24 ago 2026 — Apple: Guideline **3.1.1 In-App Purchase** — build **13**

Review date: August 24, 2026  
Device: iPad Air 11-inch (M3)  
Version reviewed: **1.0 (13)**  
Mismo Submission ID.

**Apple (resumen):** la app incluye o accede a contenido digital pago (cursos) por un medio que no es IAP. Ese contenido no se puede comprar con In-App Purchase.

El IPA 13 **no tiene** tabs de cursos. El código de cursos en git es del **25 ago** (`feature/cursos-mentorias`).

#### Reply que mandó Alexis — 24/08/2026 14:37

```
Hello App Review,

Thank you for your message.

This app is not a course store. Users cannot buy courses, videos, or subscriptions in the app.

EPoint Credit is a client portal for credit consulting. After login, clients only:

complete their personal data
upload documents
track their case on the board
manage their account
There is nothing to purchase in this app. Please continue the review of version 1.0 (13).

Demo login (no 2FA): Username: appreview@epoint.com Password: AppReview123!

Thank you, Alexis Guanique
```

Ese reply es correcto en lo del binario. **No** decía “los cursos están en la web”. Bien. Aun así Apple insistió: miran también la ficha (Support URL = epointsolution.com).

---

### 6. 26 ago 2026 18:07 — Apple: **mismo 3.1.1**, mismo **13**

No es un IPA nuevo ni cursos colados en el teléfono.

Review date: August 26, 2026  
Device: iPad Air 11-inch (M3)  
Version reviewed: **1.0 (13)**  
Submission ID: `d13dde36-a0cf-4da8-8824-7378f5e0717e`

**Apple (texto):**

> Guideline 3.1.1 - Business - Payments - In-App Purchase
>
> We noticed that the app includes or accesses paid digital content, services, or functionality by means other than In-App Purchase, which is not appropriate for the App Store. Specifically:
>
> - The app accesses digital content purchased outside the app, such as courses, but that content isn't available to purchase using In-App Purchase.
>
> Apps on the United States storefront may link out to the default browser, using buttons, external links, or other calls to action, for payment mechanisms other than in-app purchase. […]
>
> Next Steps: The paid digital content, services, or subscriptions included in or accessed by the app must be available for purchase in the app using In-App Purchase.
>
> Apps that offer paid digital services and content across multiple platforms may allow customers to access the content they acquired outside the app as long as it is also available for purchase using In-App Purchase. See guideline 3.1.3(b).

El párrafo de “United States storefront / link out” es el **template** de 3.1.1, no prueba de que el IPA tenga un catálogo. iPad otra vez = app iPhone-only en modo compatibilidad, no un build mal subido.

**Causa más probable:** Support / Privacy de la ficha = **`https://epointsolution.com/`**. Esa home vende “education platform”, módulos, mentorship y programas pagos. Review entra por el link obligatorio de la ficha.

**Qué no hacer en el reply:** explicar que los cursos se verán en la web. Eso confirma 3.1.1 / 3.1.3(b) (multiplataforma sin IAP).

**Qué sí:** el [próximo reply](#próximo-reply-listo-para-pegar-26-ago) + mismo 13 + (si se puede) URLs de privacidad/soporte que **solo** describan el portal de crédito.

Páginas “solo app” **todavía no existen**. La empresa usa epointsolution.com como URL corporativa; para Apple esa home no sirve mientras venda programas educativos. No usar `epointcredits.com` tampoco (checkout de curso).

---

## Notes vigentes en App Store Connect

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

---

## Checklist al retomar

- [ ] Reply 26 ago pegado (sin mencionar cursos en la web)
- [ ] **Actualizar revisión** con build **13**
- [ ] Privacy Policy URL y Support URL: sacar `epointsolution.com` cuando haya página solo-portal
- [ ] Description / keywords / promotional text: sin “course / education / mentorship program”
- [ ] Screenshots: solo iPhone
- [ ] No `eas build` desde `feature/cursos-mentorias`
- [ ] Anotar el próximo mensaje de Apple en este archivo
