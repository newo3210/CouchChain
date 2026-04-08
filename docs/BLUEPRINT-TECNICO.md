# CouchChain: Blueprint Técnico del Protocolo

## AI-verified travel routes, Decentralized Hospitality & Reputation on Etherlink

**Versión:** 2.0  
**Actualización:** 2026-04-08 — Módulo de Verificación y Edge Scraping

---

## 1. Visión General

CouchChain es un protocolo de logística, hospitalidad y reputación para nómadas digitales. Utiliza IA para orquestar rutas de viaje reales y blockchain para asegurar la confianza entre viajeros y comunidades. El MVP permite planificar, validar y tokenizar itinerarios, sentando las bases para una economía de viajes descentralizada donde la reputación es portable y las rutas son activos digitales replicables.

**Diferenciador técnico clave:** El único agregador de viajes que combina APIs abiertas, scraping edge local y verificación blockchain para garantizar datos reales sin costos de licencia.

---

## 2. Implementación de Funcionalidades Core

### A. Reputación y Conectividad Social

| Funcionalidad | Descripción | Estado MVP |
|-------------|-------------|------------|
| **Hosting Registrable** | Usuarios se registran como "Hosts" o "Travelers" vinculando wallet | ✅ Implementado |
| **Sistema de Trust Stamps** | Puntuación de reputación on-chain con comentarios firmados (IPFS) | ✅ Implementado |
| **Contacto Directo** | Interfaz "Puente de Confianza" para contactar hosts en ruta | ✅ Implementado |

**Arquitectura de Trust Stamps (híbrida):**

- **On-chain:** Hash de verificación (wallet A + wallet B + timestamp + geohash aproximado)
- **Off-chain:** Comentarios detallados en IPFS
- **Anti-sybil:** Emisor debe tener mínimo 1 ruta minteada previa

---

### B. Economía de Rutas Tokenizables

| Funcionalidad | Descripción | Estado MVP |
|-------------|-------------|------------|
| **Travel Route Minting** | Tokenización de itinerario estructurado (waypoints, transporte, presupuesto) | ✅ Implementado |
| **Rutas Replicables** | Clonado de rutas con referencia al original (provenance on-chain) | ✅ Implementado |
| **Social Sharing** | Distribución de rutas como tokens únicos validables por la comunidad | ✅ Implementado |
| **Subvención de Aventureros** | Mecánica preparada en contrato para fondos de marcas/comunidad basada en réplicas | 🔄 Roadmap Fase 2 |

---

## 3. Stack Tecnológico

### A. Capa de Inteligencia (Cerebro)

| Componente | Función | Tecnología |
|-----------|---------|------------|
| **Gatito AI** | Orquestación a ultra velocidad, parsing de intención, síntesis de respuestas | Groq API (Llama 3.3 70B) |
| **Lógica de Enrutamiento** | Decisión de qué fuente consultar según nivel de detalle requerido | Node.js / Next.js API Routes |

**Estrategia de Enrutamiento del Gatito:**

```
Nivel 0 (Instantáneo, $0)
├── Photon: Geocodificación de origen/destino
└── OSRM: Trazado de ruta terrestre base

Nivel 1 (Clima, $0)
└── Open-Meteo: Forecast integrado en recomendación contextual

Nivel 2 (Transporte público, créditos cuidados)
└── TransitLand: Operadores de bus en bounding box de ruta

Nivel 3 (Precios aéreos, scraping local)
└── Apify Local Scraper: Vuelos y precios en segundo plano
```

---

### B. Capa de Datos (Logística, Precios y Verificación)

| Componente | Función | Costo | Cobertura |
|-----------|---------|-------|-----------|
| **OSRM** | Trazado de rutas terrestres, geometría calle por calle | $0 | Global |
| **Photon** | Geocodificación gratuita sin API key | $0 | Global |
| **TransitLand** | Transporte público y operadores de bus | $0 (créditos limitados) | Variable (Latam parcial) |
| **Open-Meteo** | Clima en tiempo real para planificación | $0 | Global |
| **Apify Local Scraper** | Extracción de precios de vuelos y buses donde no hay APIs | $0 (infraestructura propia) | Sitios específicos configurables |

---

### C. Módulo de Verificación y Edge Scraping ($0 Cost)

**Arquitectura del Sistema:**

| Elemento | Implementación | Propósito |
|----------|---------------|-----------|
| **Local Apify Scraper** | Motor Apify/Crawlee en backend Node.js local | Extracción de precios de vuelos y boletos donde APIs gratuitas no existen |
| **Carga Diferida (Async Module)** | Worker queue separado (Bull, Bee Queue o similar) | Procesamiento intensivo en segundo plano sin bloquear UX |
| **Data Validation Pipeline** | Agentes de extracción con validación cruzada | Garantizar precios reales y disponibilidad actual, evitar "alucinaciones" de IA |

**Flujo de Datos del Módulo:**

```
Usuario solicita ruta con precios
    ↓
Gatito AI evalúa fuentes disponibles
    ↓
¿API gratuita existe para esta ruta?
    ├── SÍ → Usa OSRM + TransitLand + Open-Meteo (respuesta inmediata)
    └── NO → Dispara Apify Local Scraper (async)
                ↓
        Worker queue recibe job
                ↓
        Crawlee extrae datos de Google Flights / proveedor local
                ↓
        Data Validation: normalización, detección de outliers, freshness check
                ↓
        Resultado almacenado en cache + notificación a usuario
                ↓
        Gatito presenta: "Precios verificados [fuente] hace X minutos"
```

**Ventajas de esta arquitectura:**

| Aspecto | Beneficio |
|---------|-----------|
| **Costo cero** | Sin dependencia de SerpApi, ScraperAPI ni servicios de pago por uso |
| **Control total** | Configuración de selectores, manejo de rate limits, rotación de proxies propia |
| **Freshness garantizada** | Datos extraídos en el momento, no cache de terceros |
| **Resiliencia** | Fallback entre múltiples fuentes configurables (Google Flights, Skyscanner, Kayak, sitios locales) |

**Consideraciones de implementación:**

- **Rate limiting:** Implementar delays exponenciales y rotación de User-Agents
- **Detección de bloqueos:** CAPTCHA solving service (2captcha o similar) solo si es crítico, o notificación de "datos no disponibles temporalmente"
- **Legalidad:** Uso interno para agregación y comparación, no redistribución masiva ni competencia directa con fuentes

---

### D. Capa Blockchain (Etherlink L2)

| Componente | Función | Estado |
|-----------|---------|--------|
| **Contrato RoutePassport** | Minting de rutas, mapeo de reputación, referencias de réplicas | ✅ Deployed en Testnet |
| **Contrato TrustRegistry** | Emisión y validación de Trust Stamps, cálculo de reputación | ✅ Deployed en Testnet |
| **Hooks de Pagos** | Arquitectura preparada para escrow nativo y booking on-chain | 🔄 Fase 2 |

**Características técnicas:**

- Gas por transacción: <$0.01 (Etherlink L2)
- Tiempo de finalidad: ~2-3 segundos
- Metadata de rutas: IPFS (Pinata) con referencia on-chain

---

## 4. Flujo de Usuario (MVP)

| Etapa | Interacción | Tecnologías Activas |
|-------|-------------|---------------------|
| **1. Planificación AI** | Usuario escribe intención en lenguaje natural | Groq (parsing), Photon (geocodificación), OSRM (ruta base) |
| **2. Enriquecimiento de Datos** | Gatito consulta clima, transporte, precios | Open-Meteo, TransitLand, Apify Scraper (async si aplica) |
| **3. Personalización Visual** | Usuario ajusta pines, ve hosts en mapa, contacta vía Puente de Confianza | Leaflet, contrato de registro de hosts |
| **4. Tokenización** | Mint de ruta en Etherlink | RoutePassport contract, IPFS |
| **5. Círculo de Confianza** | Réplicas, comentarios, Trust Stamps alimentan reputación global | TrustRegistry, IPFS para contenido off-chain |

---

## 5. Roadmap de Evolución

### Fase 1: MVP (Actual)

- ✅ Planificación AI con datos reales
- ✅ Scraping local para precios de vuelos/buses
- ✅ Tokenización de rutas y reputación básica
- ✅ Contacto host-viajero sin intermediarios

### Fase 2: Economía Nativa (3-6 meses)

- 🔄 Integración de pagos en USDT/USDC nativos
- 🔄 Escrow inteligente para reservas de alojamiento
- 🔄 Subvención de aventureros (fondos de comunidad/marcas)
- 🔄 Royalties automáticos para creadores de rutas replicadas

### Fase 3: Verificación Avanzada (6-12 meses)

- 🔄 Trust Stamps geolocalizados: validación de proximidad física
- 🔄 Detección de desviaciones de ruta: "¿Encontraste algo interesente para anotar?"
- 🔄 Prompts contextuales durante el viaje: recordatorios de puntuación y comentarios
- 🔄 Modo offline: stamps vía Bluetooth mesh en zonas sin conectividad

### Fase 4: Infraestructura de Ubicación (12-18 meses)

- 🔄 Geofencing inteligente para alertas de comunidad
- 🔄 Estándar de identidad portable (DID) interoperable con otras plataformas
- 🔄 Integración con wearables para check-ins frictionless

---

## 6. Diferenciadores Técnicos para Stakeholders

### Para IBM (Smart Cities, AI, Data)

> *"CouchChain demuestra orquestación de 5+ APIs abiertas y scraping edge local para reducir latencia de planificación de 15 minutos a 30 segundos. Nuestro módulo de verificación garantiza datos frescos sin costos de licencia, modelo replicable para cualquier infraestructura de smart mobility."*

### Para Tezos (Blockchain, DeFi, Identidad)

> *"Cada ruta es un activo programable en Etherlink: reproducible, componible, con reputación acumulativa. Los Trust Stamps funcionan como credenciales verificables, sentando bases para identidad descentralizada de nómadas digitales."*

---

## 7. Métricas de Éxito del MVP

| Métrica | Objetivo | Cómo Medir |
|---------|----------|------------|
| Rutas minteadas | >100 | Eventos en contrato |
| Precios verificados por scraping | >70% de rutas aéreas | Logs de Apify Local Scraper |
| Tiempo de respuesta del Gatito | <3 segundos (APIs) / <30 segundos (con scraping) | Analytics de backend |
| Trust Stamps emitidos | >50 | Eventos en TrustRegistry |
| Costo operativo por ruta | $0 | Stack 100% gratuito |

---

**Documento preparado para presentación técnica y evaluación de arquitectura.**
