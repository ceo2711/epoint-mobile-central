# Agente especializado — Mobile ePoint CRM

Esta carpeta viaja con el repositorio. Si clonás solo el mobile en otra PC, el agente de Cursor tiene todo el contexto acá.

## Archivos

| Archivo | Uso |
|---------|-----|
| [`CONTEXT.md`](./CONTEXT.md) | Stack Expo, rutas, features, i18n, API |
| [`RULES.md`](./RULES.md) | Reglas obligatorias al modificar código |
| [`docs/VERSIONS.md`](../docs/VERSIONS.md) | Registro: qué tiene 1.0 / 2.0 / cursos, Apple, Play |
| [`docs/STORE_DEPLOYMENT.md`](../docs/STORE_DEPLOYMENT.md) | Comandos EAS, secrets, ficha Play |

## Cómo usarlo en Cursor

1. Abrí la carpeta del repo (`epoint-central-mobile` o `mobile/`) como workspace.
2. El `AGENTS.md` de la raíz apunta acá.
3. Si falta contexto: *“Leé agent/CONTEXT.md, agent/RULES.md y docs/VERSIONS.md”*.

## Rama de trabajo

- Store iOS 1.0: `release/1.0.0` (build **13** en review). No meter cursos.
- Cursos/mentorías: `feature/cursos-mentorias` (no submitear como 1.0).
- Versiones / Apple / Play: [`docs/VERSIONS.md`](../docs/VERSIONS.md).

## Repo hermano

- Backend: `epoint-backend-central` (Heroku)
- Frontend: `epoint-frontend-central` (Heroku)
- Landing: `AlexisGuanique/epoint-credits`
- Este mobile: GitHub `ceo2711/epoint-mobile-central` — **sin Heroku** (Expo / EAS)
