# Hoja · Lector EPUB

Lector de EPUB para celular y PC. Los libros se guardan en el navegador y, si conectas Google Drive, se sincronizan entre tus dispositivos: los libros se descargan solos y el progreso y los marcadores siguen donde los dejaste.

## Publicar en GitHub Pages
1. En GitHub: Settings → Pages → Source: "Deploy from a branch" → `main` / `/ (root)` → Save.
2. En un minuto queda en `https://emirmaestu.github.io/reader-emir/`.

## Activar la sincronización con Google Drive (una sola vez)
Los datos van a una carpeta oculta de **tu** Drive (`appDataFolder`) que solo esta app puede ver. Sincronizan los dispositivos donde inicies sesión con tu cuenta.

1. Entra a <https://console.cloud.google.com/> y crea un proyecto (por ejemplo "Hoja").
2. **APIs y servicios → Biblioteca** → busca **Google Drive API** → **Habilitar**.
3. **Pantalla de consentimiento de OAuth** (Google Auth Platform): tipo **Externo**, nombre "Hoja", tu email como soporte y contacto. En **Público / Usuarios de prueba** agrega tu Gmail. Puedes dejar la app en modo **Prueba**.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth** → tipo **Aplicación web**. En **Orígenes de JavaScript autorizados** agrega:
   - `https://emirmaestu.github.io`
   - `http://localhost:8123` (opcional, para probar en tu PC)
5. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pégalo en `config.js`:
   ```js
   window.HOJA_CONFIG = { googleClientId: 'TU_ID.apps.googleusercontent.com' };
   ```
   El Client ID no es secreto; se puede subir al repo.
6. Sube el cambio. En cada dispositivo abre la app y toca **Conectar Google Drive**. Como la app está en modo Prueba, Google mostrará "Google no verificó esta app": toca **Continuar**.

Notas:
- La sesión de Google dura una hora; después, el primer toque en la app la renueva sola (puede abrirse y cerrarse una ventanita).
- Los ajustes de lectura (letra, tema) no se sincronizan: cada dispositivo tiene los suyos.
- Borrar un libro lo borra también de Drive y del otro dispositivo.

## Desarrollo
- `index.html`: la app (template + lógica). `sync.js`: sincronización. `vendor/`, `fonts/`: dependencias.
- Servir localmente: `python -m http.server 8123` y abrir `http://localhost:8123`.
- Pruebas: `node --test tests/merge.test.js`.
- `tools/unbundle.py` es el script que desempaquetó el `index.html` original.
