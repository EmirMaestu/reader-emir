# Sincronización entre dispositivos con Google Drive

## Objetivo
Que los libros EPUB y el progreso de lectura pasen solos entre los dispositivos del usuario (PC y celular), guardados para siempre, sin servidor propio.

## Decisiones
- **Nube:** Google Drive, carpeta oculta `appDataFolder` (scope `drive.appdata`). Solo la cuenta del usuario y esta app acceden. "Solo mis 2 dispositivos" = los dispositivos donde se inicia sesión con esa cuenta.
- **Auth:** Google Identity Services (token client, sin backend). Requiere un OAuth Client ID (tipo Web) con origen autorizado `https://emirmaestu.github.io`. El Client ID vive en `config.js`.
- **Hosting:** GitHub Pages desde la raíz de `main` (hoy los archivos están en `deploy/` y la página da 404).
- **Código:** se desempaqueta el `index.html` bundle en archivos legibles (HTML, JS de la app, runtime, librerías y fuentes como archivos). La app debe verse y comportarse igual.

## Datos en Drive
- `book-<id>.epub` — archivo original del libro.
- `library.json` — `{ books: { <id>: { id, title, author, added, spineCount, prog: {chapter, frac, at}, marks: [...], marksAt, deleted?: at } } }`.
- Portada: no se sube; se re-extrae del EPUB al descargarlo.
- Ajustes de lectura: **no** se sincronizan (por dispositivo).

## Flujo
- **Conectar:** botón "Conectar Google Drive" en la biblioteca; el estado (conectado / sincronizando / error) se ve ahí.
- **Importar:** se guarda en IndexedDB como hoy, luego se sube el EPUB y se actualiza `library.json`.
- **Al abrir la app / volver a la pestaña / cada cierto tiempo:** bajar `library.json`, fusionar con lo local; descargar automáticamente los EPUB que falten; subir libros locales que no estén en Drive.
- **Progreso:** al leer se guarda local (como hoy) y se programa subida con debounce (~5 s), y también al ocultar la pestaña.
- **Fusión:** por libro, gana el `prog` con `at` más reciente; marcadores igual con `marksAt`. Si el libro está abierto y llega un progreso más nuevo de otro dispositivo al volver a la app, se salta a esa posición.
- **Borrar:** se marca `deleted` en `library.json` (tombstone) y se borra el EPUB de Drive; el otro dispositivo lo quita al sincronizar.
- **Sin conexión o sin sesión:** la app funciona 100% local como hoy; sincroniza cuando vuelve.
- **Token vencido:** se pide uno nuevo en silencio al interactuar; si falla, el botón vuelve a "Conectar".

## Pruebas
- La app desempaquetada se ve y funciona igual (biblioteca, importar muestra, leer, marcadores).
- Lógica de fusión probada con casos unitarios (más nuevo gana, tombstones, libros nuevos en cada lado).
- Prueba real entre dispositivos: la hace el usuario con su Client ID.
