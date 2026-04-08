# CouchChain — Contexto para agentes (MVP)

**Propósito de este documento:** servir como fuente única de verdad para LLM que implementan UI, APIs o contratos. Priorizar **decisiones explícitas** (colores, medidas, flujos) sobre descripción narrativa. Si algo no está aquí y el producto lo exige, **preguntar** o dejar TODO acotado.

**Invariante de producto:** CouchChain no es un buscador de vuelos ni una red social; es un **protocolo / agente de ruta** que compone trayectorias completas (mapa + datos agregados + verificación + registro on-chain). **Nunca bloquear** el flujo por fallo de una fuente secundaria: degradar con mensaje claro. El stack por defecto prioriza **APIs abiertas ($0)** y **scraping local** para precios cuando no hay API gratuita (ver [BLUEPRINT-TECNICO.md](../BLUEPRINT-TECNICO.md)).

---

## 1. Tema visual y atmósfera

Filosofía: **Clean & aspiracional** con toque **lúdico tipo Tamagotchi/pixel** (el Gatito). El mapa domina la atención; el resto es soporte. Evitar estética “crypto casino” (neones, gradientes agresivos). La sensación debe ser **expedición / naturaleza / permacultura**: tierra y verdes apagados sobre fondo casi blanco.

**Rasgos distintivos:**

- Canvas principal = mapa (prioridad absoluta de pixels y contraste de lectura sobre el mapa).
- Datos técnicos (precios, tiempos, hashes, addresses) en voz **monoespaciada**; narrativa y UI en **Inter**.
- Microinteracciones suaves: transiciones `ease-out` **0.3s** en movimientos del Gatito/paneles; **0.2s** fade en cambios de estado del asistente.
- Estados vacíos y errores siempre con copy humano y siguiente paso (sin callejones sin salida).

---

## 2. Paleta de color y roles

### Superficies y texto

| Token sugerido | Hex | Rol |
|----------------|-----|-----|
| `bg-page` | `#FAFAFA` | Fondo general de la app, paneles laterales |
| `bg-elevated` | `#FFFFFF` | Tarjetas, drawers, header si se separa del mapa |
| `text-primary` | `#1a1a1a` | Títulos y cuerpo principal (casi negro, legible sobre blanco) |
| `text-secondary` | `#5c5c5c` | Descripciones, metadatos |
| `text-muted` | `#8a8a8a` | Placeholders, hints |
| `border-subtle` | `rgba(0,0,0,0.08)` o `#E8E8E8` | Divisores, contornos de cards |

### Acentos (tierra / naturaleza)

| Token | Hex | Rol |
|-------|-----|-----|
| `accent-earth` | `#8B7355` | CTAs secundarios, bordes de foco suaves, iconografía principal |
| `accent-green` | `#6B8E6B` | Éxito leve, “viabilidad OK”, badges relacionados a naturaleza/host |
| `accent-earth-hover` | `#7a6549` | Hover sobre acento tierra (oscurecer ~8%) |
| `accent-green-hover` | `#5e805e` | Hover sobre acento verde |

### Semáforo (Route Ledger — viabilidad logística)

| Estado | Color sugerido | Uso |
|--------|----------------|-----|
| Verde | `#6B8E6B` (o `#4a7c59` si más contraste) | Tramos viables dentro de ventanas razonables |
| Amarillo | `#C4A35A` | Ajustable / apretado / requiere atención |
| Rojo | `#B85C5C` | Conflicto claro (tiempo, imposible encadenar) |

### Estados de interfaz

| Estado | Tratamiento |
|--------|-------------|
| Focus visible | Anillo `2px solid` en `accent-earth` o `accent-green`, offset `2px` |
| Error | Texto `#B85C5C`; no usar rojo puro `#ff0000` |
| Éxito (mint, guardado) | `accent-green` + animación breve (confeti sutil opcional) |

---

## 3. Tipografía

| Rol | Familia | Notas |
|-----|---------|--------|
| UI y lectura | `Inter`, system-ui, sans-serif | Pesos 400 / 500 / 600; evitar demasiados tamaños |
| Datos técnicos | `ui-monospace`, `SFMono-Regular`, `Menlo`, monospace | Precios, duraciones, `0x…`, CIDs IPFS |
| Logo / marca | Misma familia que UI salvo decisión explícita | No mezclar más de dos familias en pantalla |

**Jerarquía orientativa:**

| Uso | Tamaño aprox. | Peso |
|-----|----------------|------|
| Título de página | 1.5rem–1.75rem | 600 |
| Título de panel | 1.125rem–1.25rem | 600 |
| Cuerpo | 0.875rem–1rem | 400 |
| Meta / pie | 0.75rem–0.8125rem | 400–500 |
| Mono datos | 0.8125rem–0.875rem | 400–500 |

---

## 4. Layout y jerarquía de pantalla

### Desktop (referencia)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: logo | balance USDT (Etherlink) | avatar wallet     │
├──────────┬──────────────────────────────────────┬───────────┤
│ Gaveta   │                                      │ Route     │
│ Ideas    │         Mapa Leaflet (~60–70%)       │ Ledger    │
│ (colaps) │                                      │ (colaps)  │
│          │  + Gatito esquina inf. derecha       │           │
└──────────┴──────────────────────────────────────┴───────────┘
```

- **Mapa:** ocupar **60–70%** del ancho útil cuando paneles abiertos; expandir cuando laterales colapsados.
- **Paneles:** colapsables; no tapar el mapa en mobile sin intención (ver tabs).
- **Footer móvil:** tabs `Mapa | Buscar | Pasaporte | Perfil`.

### Densidad

- Prioridad: **mapa + ruta legible**.
- Información secundaria en paneles o acordeones; evitar muros de texto junto al mapa.

---

## 5. Componente “Gatito” (especificación estricta)

### Visual

- Formato: **GIF pixel art**, base **64×64 px**, escalado **2×** en UI (**128×128 px** visual).
- **4 frames** por estado; fondo **transparente**.
- Estados: `idle` | `processing` | `success` | `error` | `sleeping`

### Posición y animación

- Por defecto: **esquina inferior derecha**, **~20% visible** (solo “orejas” asomando).
- **Activación:** hover o click en orejas → desliza hacia arriba revelando cuerpo completo (`transform` + `transition: transform 0.3s ease-out`).
- **Input de chat** adyacente al Gatito (no modal flotante separado del personaje).
- Si el puntero interactúa con el **canvas del mapa**, el Gatito **vuelve** a modo orejas automáticamente.
- Cambios de estado del sprite: **fade ~0.2s** entre GIFs/frames lógicos.

### Comportamiento de producto

- Al enviar mensaje: mostrar **`processing` de inmediato** (antes de que respondan las APIs).
- Objetivo de experiencia: respuesta percibida **&lt; 2 s** cuando sea viable; si el backend tarda, mantener `processing` y permitir copy parcial tipo “Sigo conectando datos…”.
- Si falla una fuente (p. ej. TransitLand o job de scraping): mensaje tipo *“No pude verificar vuelos ahora; acá va la ruta terrestre.”* o *“Sigo verificando precios en segundo plano…”* — **`processing`/`error` leve**, no bloquear mapa.
- Objetivo de latencia (Blueprint): **&lt;3 s** para respuesta basada en APIs abiertas; **hasta ~30 s** o **async** cuando interviene el módulo de scraping (notificar *“Precios verificados [fuente] hace X minutos”* al completar el job).

### Micro (idle)

- Parpadeo ocasional; movimiento de cola aprox. cada **5 s** (si el asset lo permite).

---

## 6. Mapa, pins y ruta

- **Leaflet** con tiles que respeten legibilidad (estilo acorde a paleta; no saturar).
- **Ruta:** polyline clara; contraste suficiente sobre tile claro u oscuro según tema del mapa.
- **Pin de ruta:** arrastrable; al soltar, **recalcular ruta** con **debounce** (evitar martillar **OSRM** u otro motor de routing configurado).
- **Hover pin:** card flotante con foto (si hay), nombre, rating, **precio estimado** cuando aplique.
- **Pin host “acepta viajeros”:** distintivo visual consistente (icono + badge tierra/verde).

---

## 7. Flujos de producto MVP (resumen operativo)

### 7.1 Chat → ruta (enrutamiento por niveles — Gatito)

1. Usuario escribe intención libre (origen, destino, presupuesto, intereses).
2. **Parsing** (Groq) → JSON estructurado validado (p. ej. Zod).
3. **Agregación por niveles (Blueprint):**
   - **N0:** Photon (geocode) + OSRM (ruta terrestre base) — inmediato, $0.
   - **N1:** Open-Meteo (clima) — inmediato, $0.
   - **N2:** TransitLand (transporte público en bbox) — créditos/cuotas; degradar si vacío.
   - **N3:** Si se requieren precios aéreos/bus y no hay API gratuita → **encolar** job de **Apify/Crawlee local**; respuesta inicial sin bloquear mapa; **pipeline de validación** (normalización, outliers, *freshness*); resultado en caché + UI actualizada.
4. **Síntesis** (Groq) → texto conversacional + **payload estructurado** para el mapa (waypoints, segmentos, badges de fuente/frescura).
5. Render en mapa + paneles (Gaveta / Ledger).

### 7.2 Guardar / mint

1. Usuario confirma itinerario.
2. Construir JSON de ruta (ver §9), subir a **IPFS (Pinata)**.
3. Llamada al contrato **`RoutePassport`** (p. ej. `createRoute(ipfsHash)` o interfaz equivalente desplegada) en **Etherlink testnet**; soportar **réplicas** con provenance on-chain si el contrato lo expone.
4. Feedback: animación corta (~1 s) “compilación” → wallet prompt → éxito con **confeti sutil** opcional.

### 7.3 Puente de Confianza (sin chat en tiempo real)

1. Click en pin host → “Contactar anfitrión”.
2. Tres plantillas: *Solicitud de estadía [fechas]* | *Consulta de disponibilidad* | *Propuesta de intercambio (habilidad por hospedaje)*.
3. Nota opcional **máx. 140 caracteres**.
4. Mensaje estructurado con metadata: nombre desde wallet, **reputación (TrustRegistry / stamps)**, ruta activa si existe, fechas. **Anti-sybil (Blueprint):** quien emite stamps debe tener al menos **una ruta minteada** previa (validar en UI/contrato según implementación).
5. Host recibe notificación (email/push según implementación); respuestas discretas: **Disponible / No disponible / Preguntar más**.
6. Si **Disponible**: revelar contacto externo acordado (WhatsApp/Telegram) a ambas partes.

---

## 8. Stack técnico MVP (Blueprint v2.0)

| Capa | Elección |
|------|----------|
| Framework | Next.js (App Router), React, Tailwind CSS |
| Mapa | Leaflet |
| IA | Groq — parsing, síntesis JSON, orquestación de niveles de datos |
| Geocoding / ruta | Photon + OSRM (URL configurable; instancia propia en prod) |
| Clima | Open-Meteo |
| Transporte público | TransitLand (cuotas; degradar) |
| Precios sin API paga | Apify + Crawlee **local**, cola (**Bull/Bee Queue** + **Redis**), validación + caché |
| Cadena | Etherlink testnet: **`RoutePassport`** + **`TrustRegistry`** |
| IPFS | Pinata (rutas + contenido off-chain de stamps) |
| Datos | PostgreSQL (índice, jobs, caché, Puente de Confianza) |

**Opcional (con coste):** Google Maps, Kiwi — solo como enriquecimiento explícito, no como supuesto default.

**Endpoints orientativos:** `POST /api/route-plan` (síncrono + encolado N3); worker separado para consumers del scraper.

---

## 9. Modelos de datos (contrato mínimo)

### 9.1 On-chain — `RoutePassport`

- Mint de itinerario con metadata **IPFS**; soporte de **réplicas** / provenance según ABI desplegado.

### 9.2 On-chain — `TrustRegistry`

- Emisión y validación de **Trust Stamps**; cálculo de reputación.
- **Trust híbrido (Blueprint):** on-chain almacena **hash de verificación** (p. ej. wallets + timestamp + geohash aproximado); **comentarios** detallados en **IPFS**.

### 9.3 Anti-sybil

- Emisor de stamp: debe existir al menos **una ruta minteada** previa (regla de producto; implementar vía contrato o comprobación en cliente + eventos).

### 9.4 Off-chain — JSON en IPFS (forma lógica — ruta)

```json
{
  "version": "1.0",
  "created_at": "<ISO-8601>",
  "creator": "0x…",
  "route_data": {
    "origin": { "name": "string", "lat": 0, "lng": 0 },
    "destination": { "name": "string", "lat": 0, "lng": 0 },
    "waypoints": [],
    "transport_segments": [],
    "estimated_budget": { "currency": "USDT", "amount": 0 }
  },
  "metadata": {
    "tags": [],
    "photos": ["ipfs://…"],
    "ai_synthesis": "string"
  }
}
```

Los tipos exactos de `waypoints` y `transport_segments` deben alinearse entre **frontend**, **API** y **subida IPFS**; documentar en código (`lib/types/route.ts`).

---

## 10. Componentes UI adicionales (pautas)

### Botones

- Primario: fondo `accent-earth`, texto blanco o `#FAFAFA`; hover `accent-earth-hover`.
- Secundario: borde `accent-earth`, fondo transparente o `bg-elevated`.
- Destructivo: solo si hay acción irreversible; usar rojo semántico §2.

### Cards (preview pin, items en Pasaporte)

- Radio **8px**; sombra muy sutil o borde `border-subtle`.
- Imagen opcional con ratio fijo; fallback icono mapa.

### Mint / loading

- Skeletons o spinner discreto en tono tierra; no bloquear interacción con mapa salvo modal de wallet.

### Trust Stamp nuevo

- Badge en perfil con animación tipo “sello” (**sin sonido**).

---

## 11. Fuera de alcance MVP (no implementar como si fuera requerido)

- Booking real de alojamiento; pagos crypto más allá del mint de registro.
- Chat persistente nativo; app móvil nativa (solo responsive web).
- Sistema de reviews complejo (demo puede usar Trust Stamps simulados de forma acotada).

---

## 12. Checklist rápido para el agente antes de entregar UI

- [ ] Mapa ocupa protagonismo; paleta **#FAFAFA / #8B7355 / #6B8E6B** respetada.
- [ ] Inter + mono para datos técnicos.
- [ ] Gatito: 64 base ×2 escala, 5 estados, orejas 20%, retract al mapa, chat junto al bicho.
- [ ] Fallo API secundaria no rompe ruta terrestre.
- [ ] Focus visible y contraste adecuado en controles sobre mapa.
- [ ] No exponer secretos (Groq, Pinata, Redis, tokens TransitLand, keys opcionales) al cliente.

---

## 13. Referencias en repo

- Blueprint protocolo v2.0: [BLUEPRINT-TECNICO.md](../BLUEPRINT-TECNICO.md)
- Registros y APIs: [REGISTROS-Y-APIS.md](../REGISTROS-Y-APIS.md)
- Plan de fases y estructura: [README.md](../../README.md)

**Fin del contexto LLM — mantener este archivo actualizado cuando cambien decisiones de producto o diseño.**
