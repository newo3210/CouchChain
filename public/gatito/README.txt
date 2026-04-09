Por defecto el UI usa SVG en esta carpeta (idle.svg, …) para evitar 404 en producción.

Opcional — sustituir por GIF pixel-art con el mismo nombre base:

  idle.gif       — animación de reposo (parpadeo, cola cada 5s)
  processing.gif — animación "pensando" (ojos girando, movimiento)
  success.gif    — saltito de alegría
  error.gif      — cabeza inclinada / ojitos tristes
  sleeping.gif   — Zzz encima de la cabeza

Y en GatitoAssistant.tsx cambiar SPRITES a las rutas .gif.

Especificaciones (COUCHCHAIN-LLM.md §5):
- Pixel art, 64×64 px base, fondo transparente
- 4 frames por estado
- El componente escala a 128×128 px en UI (image-rendering: pixelated)

Si una imagen falla al cargar, el componente muestra emojis como respaldo.
