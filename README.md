# Loopdesk

Un escritorio personal en el navegador con reproductor de música y un fondo vectorial (SVG) que se mueve y cambia de color según el tono de la canción.

## Qué hace

- **Escritorio**: carpetas, enlaces y notas que mueves libremente. Arrastra un elemento sobre una carpeta para guardarlo dentro. Clic derecho para renombrar, cambiar icono (emoji + color, o imagen propia), mover o borrar. Suelta una URL en el escritorio y se crea el enlace con su favicon.
- **Música**: añade archivos o una carpeta entera (o suéltalos sobre el escritorio). Se guardan en IndexedDB del navegador, así que funcionan sin conexión. Aleatorio, repetir, volumen, teclas multimedia y barra espaciadora.
- **Buscar online**: busca en Audius (catálogo abierto) y reproduce por streaming; con ⬇ guardas la pista en tu biblioteca.
- **Fondo**: líneas vectoriales en lazo, estilo *The Loop*. Reacciona a graves (amplitud), medios y agudos, y el color sigue el centroide espectral (el "tono" percibido). Ajustes: líneas, velocidad, amplitud, lazos, grosor, dispersión, sensibilidad, brillo, paletas, colores propios, aleatorio y **exportar SVG**.
- Todo se guarda solo (localStorage + IndexedDB).

## Publicar en GitHub Pages

1. Crea un repositorio y sube `index.html`, `style.css`, `app.js` y este `README.md`.
2. Settings → Pages → *Deploy from a branch* → `main` / root.
3. Abre `https://TU_USUARIO.github.io/TU_REPO/`.

Para probarlo en local: `python3 -m http.server` y abre `http://localhost:8000`.

## Notas

- Los datos viven en el navegador de cada dispositivo; no hay servidor ni cuentas.
- El análisis de audio necesita que el stream permita CORS. Con tus archivos locales siempre funciona; si una pista online no lo permite, sonará pero el fondo se quedará quieto.
- No incluye descargas desde YouTube/Spotify y similares: incumple sus condiciones y los derechos de autor. Usa tus propios archivos o fuentes con licencia abierta (Audius, Jamendo, Internet Archive…).
