# Loopdesk v2

Escritorio personal en el navegador, centrado en el reproductor de música. Es estático (HTML, CSS y JS sin dependencias): súbelo a GitHub Pages tal cual.

## Reproductor
- **Biblioteca local**: añade archivos o una carpeta (o suéltalos en el escritorio). Se guardan en IndexedDB y suenan sin conexión.
- **Buscar**: YouTube, Audius y Jamendo en una sola búsqueda. También puedes pegar un enlace de YouTube, Spotify o un `.mp3`.
  - YouTube: se reproduce con su reproductor oficial en un panel de vídeo flotante. Para buscar con fiabilidad, pon tu clave gratuita de la YouTube Data API en *Música → Fuentes*.
  - Spotify: pega el enlace de una canción, álbum o playlist; se reproduce con el reproductor oficial incrustado (30 s de preview si no has iniciado sesión en Spotify en ese navegador).
  - Descargar (↓) solo funciona con fuentes que lo permiten (Audius, Jamendo, mp3 directos) y con tus archivos. YouTube y Spotify no se pueden descargar.
- **Favoritos**: corazón en cualquier canción, de cualquier fuente.
- **Mini reproductor**: tres tamaños (completo, compacto, punto), portada opcional, estilo (cristal, sólido, neón), color, opacidad y tamaño. Arrastrable.
- **Ventana flotante**: botón de la esquina del mini reproductor. Usa Document Picture-in-Picture (Chrome/Edge) y se queda por encima de otras pestañas y ventanas. Además hay soporte de teclas multimedia y panel de medios del sistema (Media Session).

## Escritorio
- Carpetas, enlaces y notas; arrastra sobre una carpeta para guardar dentro.
- **Iconos**: clic derecho → Cambiar icono. Busca entre +200 colecciones (Iconify), pega la URL de cualquier imagen/SVG de cualquier web, usa el favicon de una web, sube la tuya, o elige entre los iconos básicos y emoji.
- **Fondo**: imagen, GIF, vídeo (subido o por URL), color o degradado.

## Publicar
Sube `index.html`, `style.css`, `app.js` y este README a un repositorio → Settings → Pages → rama `main`. Local: `python3 -m http.server`.

Los datos viven en el navegador de cada dispositivo.
