# Registros y APIs — CouchChain MVP

Documento de referencia para **cuentas, productos habilitados y credenciales**, alineado con el [Blueprint técnico v2.0](BLUEPRINT-TECNICO.md) (stack $0 + módulo de verificación y *edge scraping*). Las URLs pueden cambiar: verificar en la documentación oficial.

**Seguridad:** no commitear secretos. Usar `.env.local` y un `.env.example` sin valores reales. Cualquier clave de backend (Groq, cola, scraper, Pinata) debe vivir **solo en servidor** o en procesos worker, no en el bundle del cliente.

---

## Checklist rápida (Blueprint v2.0)

| # | Servicio | Prioridad MVP | Estado (rellenar) |
|---|----------|---------------|-------------------|
| 1 | Groq | Obligatorio (Gatito: parsing + síntesis) | ☐ |
| 2 | Photon (geocoding) | Obligatorio (sin key en uso típico) | ☐ |
| 3 | OSRM | Obligatorio (URL pública o instancia propia) | ☐ |
| 4 | Open-Meteo | Obligatorio (sin key en uso típico) | ☐ |
| 5 | TransitLand | Recomendado (transporte público; revisar cuotas/token) | ☐ |
| 6 | Redis + worker scraping | Recomendado si Nivel 3 (Apify/Crawlee local, Bull/Bee Queue) | ☐ |
| 7 | Pinata | Obligatorio (IPFS rutas + metadata Trust off-chain) | ☐ |
| 8 | Etherlink testnet + wallet | Obligatorio (`RoutePassport` + `TrustRegistry`) | ☐ |
| 9 | PostgreSQL | Recomendado (índice, caché, Puente de Confianza, jobs) | ☐ |
| 10 | Email transaccional | Opcional (notificaciones host) | ☐ |
| 11 | Tiles Leaflet | Según proveedor OSM/MapTiler/etc. | ☐ |
| 12 | Solver CAPTCHA (p. ej. 2captcha) | Solo si el scraper lo exige | ☐ |
| 13 | Google Maps / Kiwi | **Opcional** (enriquecimiento con coste; no es el camino default del Blueprint) | ☐ |

---

## 1. Groq (IA — Gatito)

| Campo | Detalle |
|--------|---------|
| **Uso** | Parsing de intención; síntesis conversacional; decisión de qué niveles de datos invocar; salida JSON validada para mapa y ledger. |
| **Registro** | [https://console.groq.com](https://console.groq.com) |
| **Credencial** | API Key |
| **Variable** | `GROQ_API_KEY` |
| **Notas** | Límites de rate; validar JSON (p. ej. Zod). Objetivo de latencia: &lt;3 s para respuesta que no dependa del scraper async. |

---

## 2. Photon (geocodificación — Nivel 0)

| Campo | Detalle |
|--------|---------|
| **Uso** | Geocodificación de origen/destino sin coste de licencia Google. |
| **Documentación** | [https://photon.komoot.io](https://photon.komoot.io) (API pública Komoot; existen instancias self-hosted). |
| **Credencial** | Ninguna en el servicio público habitual. |
| **Variables** | Opcional: `PHOTON_BASE_URL` si usas instancia propia. |
| **Notas** | Respetar políticas de uso y *fair use* del endpoint público; para producción alta escala, instancia propia. |

---

## 3. OSRM (rutas terrestres — Nivel 0)

| Campo | Detalle |
|--------|---------|
| **Uso** | Geometría de ruta, tiempos/distancias sobre red vial. |
| **Documentación** | [http://project-osrm.org](http://project-osrm.org) |
| **Credencial** | Depende del host (servidor demo público sin key; producción: tu instancia). |
| **Variable** | `OSRM_BASE_URL` (p. ej. `https://router.project-osrm.org` solo para pruebas). |
| **Notas** | El servidor público tiene límites; no abusar. Auto-hospedar o proveedor para carga real. |

---

## 4. Open-Meteo (clima — Nivel 1)

| Campo | Detalle |
|--------|---------|
| **Uso** | Forecast para recomendaciones contextuales en la ruta. |
| **Documentación** | [https://open-meteo.com](https://open-meteo.com) |
| **Credencial** | No requerida para uso API estándar. |
| **Variables** | Opcional: parametrizar unidad de modelo si se usa API avanzada. |
| **Notas** | Atribución según términos del proyecto. |

---

## 5. TransitLand (transporte público — Nivel 2)

| Campo | Detalle |
|--------|---------|
| **Uso** | Operadores de bus / feeds en *bounding box* de la ruta. |
| **Documentación** | [https://www.transit.land/documentation](https://www.transit.land/documentation) |
| **Credencial** | Revisar versión actual de API: token o API key según plan (*credits* limitados en tier gratuito). |
| **Variable** | `TRANSITLAND_API_KEY` o `TRANSITLAND_TOKEN` (nombre según doc oficial). |
| **Notas** | Cobertura variable (Latam parcial). Degradar con gracia si no hay feeds. |

---

## 6. Módulo de verificación y *edge scraping* (Nivel 3)

| Campo | Detalle |
|--------|---------|
| **Uso** | Precios de vuelos/buses donde no hay API gratuita; Crawlee/Apify en **Node local**; jobs async. |
| **Componentes** | Worker Node (consumer), Redis para Bull/Bee Queue, PostgreSQL para estado/cache y *freshness*. |
| **Variables típicas** | `REDIS_URL`; opcional `SCRAPER_CONCURRENCY`, `PROXY_LIST` (si rotación propia). |
| **CAPTCHA** | Solo si es crítico: proveedor tipo 2captcha — `TWO_CAPTCHA_API_KEY` (u otro). |
| **Notas legales** | Uso interno para agregación/comparación; respetar robots/ToS de cada sitio; selectores frágiles — aislar en módulo configurable. |
| **UX** | El Gatito debe poder decir: *“Precios verificados [fuente] hace X minutos”* tras el job; no bloquear ruta terrestre mientras tanto. |

---

## 7. Pinata (IPFS)

| Campo | Detalle |
|--------|---------|
| **Uso** | Metadata de rutas; comentarios / contenido off-chain de Trust Stamps (según diseño del contrato). |
| **Registro** | [https://pinata.cloud](https://pinata.cloud) |
| **Credenciales** | JWT y/o API Key + Secret. |
| **Variables** | `PINATA_JWT` o `PINATA_API_KEY` + `PINATA_SECRET_API_KEY` |
| **Notas** | Subida desde servidor; no exponer secretos al cliente. |

---

## 8. Etherlink + wallet

| Campo | Detalle |
|--------|---------|
| **Uso** | `RoutePassport` (mint rutas, réplicas); `TrustRegistry` (stamps, reputación). |
| **Documentación** | [https://docs.etherlink.com](https://docs.etherlink.com) |
| **Variables** | `NEXT_PUBLIC_ETHERLINK_RPC_URL`, `NEXT_PUBLIC_ETHERLINK_CHAIN_ID`, `NEXT_PUBLIC_CONTRACT_ADDRESS` (RoutePassport), `NEXT_PUBLIC_TRUST_REGISTRY_ADDRESS` |
| **Wallet** | MetaMask o compatible; XTZ de prueba vía faucet oficial. |
| **Notas** | Verificar RPC y chain ID vigentes en la doc (testnet puede migrar). |

---

## 9. PostgreSQL

| Campo | Detalle |
|--------|---------|
| **Uso** | Índice de rutas por wallet, solicitudes Puente de Confianza, resultados validados del scraper, caché OSRM/TransitLand. |
| **Variable** | `DATABASE_URL` |

---

## 10. Email transaccional (opcional)

| Campo | Detalle |
|--------|---------|
| **Uso** | Notificación al host en Puente de Confianza. |
| **Variables** | `RESEND_API_KEY` / `SENDGRID_API_KEY`, `EMAIL_FROM`, etc. |

---

## 11. Tiles Leaflet

| Campo | Detalle |
|--------|---------|
| **Uso** | Capa base del mapa. |
| **Variables** | `NEXT_PUBLIC_MAP_TILE_URL` o key del proveedor si aplica. |

---

## 12. Enriquecimiento opcional (con coste)

| Campo | Detalle |
|--------|---------|
| **Google Maps Platform** | Geocoding, Directions, Places — ver [Google Cloud Console](https://console.cloud.google.com); variable típica `GOOGLE_MAPS_API_KEY`. |
| **Kiwi.com / Tequila** | Transporte multimodal comercial — variable típica `KIWI_API_KEY`. |
| **Notas** | No forman parte del stack $0 del Blueprint; útiles como fallback o demo en regiones sin datos TransitLand. |

---

## Resumen de variables de entorno (plantilla)

```bash
# IA
GROQ_API_KEY=

# Nivel 0
# PHOTON_BASE_URL=
OSRM_BASE_URL=

# Nivel 2
TRANSITLAND_API_KEY=

# Nivel 3 (scraping async)
REDIS_URL=
# TWO_CAPTCHA_API_KEY=

# IPFS
PINATA_JWT=

# Etherlink
NEXT_PUBLIC_ETHERLINK_RPC_URL=
NEXT_PUBLIC_ETHERLINK_CHAIN_ID=
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_TRUST_REGISTRY_ADDRESS=

# Datos
DATABASE_URL=

# Opcional
# RESEND_API_KEY=
# EMAIL_FROM=
# NEXT_PUBLIC_MAP_TILE_URL=

# Opcional — APIs de pago
# GOOGLE_MAPS_API_KEY=
# KIWI_API_KEY=
```

---

## Enlaces en repo

| Recurso | Ubicación |
|---------|-----------|
| Blueprint v2.0 | [BLUEPRINT-TECNICO.md](BLUEPRINT-TECNICO.md) |
| Plan y estructura | [README.md](../README.md) |
| Contexto LLM | [llm-prepared/COUCHCHAIN-LLM.md](llm-prepared/COUCHCHAIN-LLM.md) |

---

*Revisar periódicamente TransitLand, OSRM público y políticas de scraping antes de producción.*
