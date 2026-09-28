# Sincronización con Google Drive — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sincronizar libros EPUB, progreso y marcadores entre dispositivos usando `appDataFolder` de Google Drive.

**Architecture:** Se desempaqueta el bundle (`deploy/index.html`) en archivos estáticos en la raíz del repo. La app sigue siendo un componente "DC" (template `<x-dc>` + clase `Component` en `<script type="text/x-dc">`) que corre sobre `vendor/dc-runtime.js`. La lógica nueva va en `sync.js` (`window.HojaSync`: fusión pura + cliente Drive + auth GIS), y la clase `Component` la orquesta (IndexedDB, localStorage, UI).

**Tech Stack:** HTML/JS estático, React 18 (vía dc-runtime), JSZip, Google Identity Services (token client), Drive REST v3, `node:test` para pruebas unitarias.

---

## Estructura de archivos

- `index.html` — template desempaquetado + UI de sincronización + orquestación en `Component`.
- `sync.js` — `mergeLibrary`, `Drive` (REST), `Auth` (GIS). Exporta `window.HojaSync` y `module.exports` (para node).
- `config.js` — `window.HOJA_CONFIG = { googleClientId: '' }`.
- `vendor/` — `dc-runtime.js`, `ds-bundle.js`, `jszip.min.js`, `react.production.min.js`, `react-dom.production.min.js`.
- `fonts/*.woff2` — fuentes extraídas del bundle.
- `samples/muestra.zip`, `.nojekyll`, `README.md` — movidos de `deploy/`.
- `tests/merge.test.js` — pruebas de `mergeLibrary`.
- `tools/unbundle.py` — script usado para desempaquetar (reproducible).

## Task 1: Desempaquetar y mover a la raíz
- [ ] `tools/unbundle.py deploy/index.html .` extrae manifest (base64 + gzip) a `vendor/` y `fonts/`, reemplaza los uuids del template por rutas relativas e inyecta `<script>window.__resources = {<url unpkg react>: 'vendor/react.production.min.js', <react-dom>: 'vendor/react-dom.production.min.js'}</script>` antes del runtime.
- [ ] `git mv deploy/samples deploy/README.md .`, borrar `deploy/`, añadir `.nojekyll`.
- [ ] Servir con `python -m http.server` y verificar en el navegador: biblioteca visible, "libro de muestra" importa y abre, se pasa de página, sin errores de consola.
- [ ] Commit `refactor: desempaquetar bundle en archivos estáticos en la raíz`.

## Task 2: `mergeLibrary` (TDD)
Forma de la biblioteca: `{ books: { [id]: { id, title, author, added, spineCount, prog?: {chapter, frac, at}, marks?: [], marksAt?: number, deleted?: number } } }`.
Reglas: unión por id; `prog` con `at` mayor gana; `marks` con `marksAt` mayor gana; `deleted` = máximo de ambos (un tombstone gana siempre); metadatos del lado que los tenga (local si ambos). Devuelve `{ lib, progFromRemote: [ids], changedLocal: bool, changedRemote: bool }`.
- [ ] Escribir `tests/merge.test.js`: libro solo remoto → aparece; solo local → aparece y `changedRemote`; progreso remoto más nuevo gana y su id va en `progFromRemote`; progreso local más nuevo gana; marcadores por `marksAt`; tombstone remoto borra libro local; tombstone local se propaga.
- [ ] `node --test tests/` → FAIL.
- [ ] Implementar en `sync.js`.
- [ ] `node --test tests/` → PASS. Commit.

## Task 3: Cliente Drive y Auth en `sync.js`
- `Auth`: carga `https://accounts.google.com/gsi/client` bajo demanda; `initTokenClient({ client_id, scope: 'https://www.googleapis.com/auth/drive.appdata' })`; guarda `{token, exp}` en `localStorage['hoja:gtoken']`; `connect()` (con consentimiento), `refresh()` (`prompt: ''`, requiere gesto del usuario), `token()` (null si vencido), `disconnect()`.
- `Drive`: `list()` (`spaces=appDataFolder`, paginado), `getText(id)`, `getBlob(id)`, `upload(name, blob, mime, id?)` (multipart create / media update), `remove(id)`. Un 401 lanza `AuthError`.
- `HojaSync.drive` reemplazable (para pruebas con un Drive falso en memoria).
- [ ] Implementar. Commit.

## Task 4: Orquestación en `Component`
- Marcadores con fecha: `updateMarks`/`addBookmark` guardan `ls('marksAt:'+id, Date.now())`.
- Borrar: `removeBook` guarda tombstone en `ls('tomb')` y limpia `prog:`/`marks:`; luego `syncSoon(0)`.
- `saveProgress` → `syncSoon(5000)`; `importFiles` → `syncSoon(0)`.
- `sync()`: con mutex; lista archivos; baja `library.json`; arma biblioteca local (IDB + ls + tombstones); `mergeLibrary`; borra local/remoto los tombstones; descarga EPUB faltantes (portada re-extraída con `parseOpf`); sube EPUB que falten; aplica prog/marks remotos solo si son más nuevos que el valor local actual; sube `library.json` si cambió; `loadBooks()`. Si el libro abierto recibe progreso remoto más nuevo → `goTo(chapter, {frac})`.
- Disparadores: al montar, al volver visible, al ocultar (flush), cada 2 min; si el token venció, el primer clic del usuario lo renueva y sincroniza.
- UI: píldora en el header de la biblioteca: "Conectar Google Drive" / "Sincronizando…" / "Sincronizado hh:mm" / "Toca para reconectar" / error; sin Client ID → aviso "Configura el Client ID (README)". Banner "Descargando «título»…".
- [ ] Implementar. Probar en navegador con Drive falso inyectado (dos "dispositivos" simulados limpiando IndexedDB/localStorage entre pasos). Commit.

## Task 5: Documentación y publicación
- [ ] README: pasos para crear el Client ID (Google Cloud Console → proyecto → pantalla de consentimiento (External, añadir tu email como test user) → habilitar Drive API → Credenciales → OAuth client ID Web con origen `https://emirmaestu.github.io`), pegarlo en `config.js`, activar Pages desde `main` / root.
- [ ] Commit y push a `main`.
