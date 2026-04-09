Por defecto el UI usa SVG en esta carpeta (idle.svg, …) para evitar 404 en producción.

Opcional — sustituir por GIF pixel-art con el mismo nombre base:

  idle.gif       — animación de reposo (parpadeo, cola cada 5s)
  processing.gif — animación "pensando" (ojos girando, movimiento)
  success.gif    — saltito de alegría
  error.gif      — cabeza inclinada / ojitos tristes
  sleeping.gif   — Zzz encima de la cabeza

Hay también *.gif (1×1 px, placeholder) para clientes viejos o caché que aún pidan .gif sin 404.

Para pixel-art real: sustituir esos GIF y en GatitoAssistant.tsx usar rutas .gif en SPRITES si querés animación.

Especificaciones (COUCHCHAIN-LLM.md §5):
- Pixel art, 64×64 px base, fondo transparente
- 4 frames por estado
- El componente escala a 128×128 px en UI (image-rendering: pixelated)

Si una imagen falla al cargar, el componente muestra emojis como respaldo.
