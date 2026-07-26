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

11. No romper SecureStore / refresh / flujo 2FA / `must_change_password`.
12. Chat flotante **solo** para `CLIENT`. No mostrarlo en staff.
13. Respetar header `X-Merchant-Id` en staff multi-comercio.

## Documentos y gestos

14. Tras cerrar `UploadSourceSheet`, esperar dismiss (`waitForModalDismiss`) antes de abrir cámara/picker.
15. En Kanban, usar `useSuppressBackGesture` para no pelear con el gesto atrás horizontal.
16. Alternativas de docs: priorizar grupo resuelto (misma lógica que web/backend).

## Env y git

17. `.env` en gitignore. Tras cambiar `EXPO_PUBLIC_*` → `npx expo start -c`.
18. No hay Heroku: solo `git push origin HEAD` (rama actual, p.ej. `release/1.0.0`).
19. Commits en español, enfocados en el *porqué*.

## Calidad

20. Antes de cerrar cambios TypeScript: `npm run lint` (`tsc --noEmit`).
