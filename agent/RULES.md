# Reglas — Mobile ePoint CRM

Obligatorias para cualquier agente que modifique este repo.

## Expo / RN

1. SDK del proyecto: **54**. Docs: https://docs.expo.dev/versions/v54.0.0/ — ignorar referencias a v57 en notas viejas.
2. Rutas solo vía Expo Router en `app/`. Navegación staff/portal con `appNavigation.ts` y `AppShell`.

## UI

3. Preferir `StyleSheet` + `theme/tokens.ts`. **No** introducir `className`/NativeWind salvo unificación explícita pedida.
4. Reutilizar `src/components/ui/*` (Button, Card, Input, Select, Section…).
5. Pantallas auth: `AuthGlassShell` + `DesertBackground`. Logo/marca vía `topLeftContent` (dentro del scroll, no absoluto suelto).
6. Textos sobre el fondo animado: color claro + sombra suave. Labels de inputs → placeholders cuando se pida ahorrar espacio.
7. Evitar layouts genéricos AI (purple glow, cream+terracotta, cards innecesarias en hero).

## i18n

8. Locale = idioma del **dispositivo** (`LanguageContext` + `expo-localization`). No reintroducir `LanguageSwitcher` salvo pedido explícito.
9. Claves nuevas en `src/i18n/locales/es.ts` **y** `en.ts`.
10. Muchas pantallas staff aún tienen strings hardcodeados: al tocarlas, migrar a `t()` si es razonable.

## Auth y roles

11. No romper SecureStore / refresh / login 2FA **si la cuenta ya lo tiene** / `must_change_password`.
12. **No** forzar setup de autenticador en `CLIENT` (`MandatoryTwoFactorModal`). App Store 4.2.3(i). Staff sí sigue obligado en este binario.
13. Chat flotante **solo** para `CLIENT`. No mostrarlo en staff.
14. Respetar header `X-Merchant-Id` en staff multi-comercio.

## Documentos y gestos

15. Tras cerrar `UploadSourceSheet`, esperar dismiss (`waitForModalDismiss`) antes de abrir cámara/picker.
16. En Kanban, usar `useSuppressBackGesture` para no pelear con el gesto atrás horizontal.
17. Alternativas de docs: priorizar grupo resuelto (misma lógica que web/backend).

## Env y git

18. `.env` en gitignore. Tras cambiar `EXPO_PUBLIC_*` → `npx expo start -c`.
19. No hay Heroku: solo `git push origin HEAD` (rama actual). Store 1.0 = `release/1.0.0`. Cursos = `feature/cursos-mentorias`.
20. Commits en español, enfocados en el *porqué*.
21. **`ios.supportsTablet: false`**. No volver a `true` sin un layout iPad real; Apple rechazó 2.1(a) por eso.
22. **No** incluir player/venta de cursos en el binario de App Store 1.0. Apple rechazó 3.1.1 IAP. Esta feature branch no se submitea como 1.0.
23. Notes de Apple: solo `appreview@epoint.com` / `AppReview123!`. Nunca cuentas con TOTP.
24. Replies a App Review: seguí [`docs/APP_REVIEW.md`](../docs/APP_REVIEW.md). **No** decir que los cursos están en la web (eso es 3.1.1). Un Reply exige **Actualizar revisión** con el **mismo build 13**.

## Calidad

25. Antes de cerrar cambios TypeScript: `npm run lint` (`tsc --noEmit`).
26. Si cambia el alcance de una versión de store, un build/submit, o un rechazo de Apple/Play, actualizá [`docs/VERSIONS.md`](../docs/VERSIONS.md) y el hilo en [`docs/APP_REVIEW.md`](../docs/APP_REVIEW.md) en el mismo commit.
